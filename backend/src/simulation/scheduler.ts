// NCC IT — deterministic tick-driven progression. Called on a fixed interval from
// instrumentation.ts (one process-wide tick source, not a per-page setInterval). Each rule reads
// the current tick count, so re-seeding from scratch reproduces the same progression.
import { randomUUID } from 'node:crypto';
import { advanceClock } from './clock';
import { saveState } from './store';
import { completeOnboardingScan, pushPostureEvent, COLLECTOR_LIFECYCLE } from './engine';
import { discoverAssetsForCollector } from './generators/onboarding';
import { syncNccDiscovery } from './ncc-discovery';
import type { CollectorRecord, CollectorStatus, SimState } from './types';

const TICK_MS = 15_000;

function progressScans(draft: SimState): void {
    for (const scan of draft.scans) {
        if (scan.status !== 'running') continue;
        const done = (scan.progress.done ?? 0) + 1;
        const total = scan.progress.total ?? done;
        scan.progress = { ...scan.progress, done: Math.min(done, total) };
        if (done >= total) {
            scan.status = 'succeeded';
            scan.finished_at = new Date().toISOString();
            if (scan.purpose === 'asset_onboarding') completeOnboardingScan(draft, scan);
        }
    }
    // Advance one queued scan into running once nothing else is active, so the queue actually moves.
    const anyRunning = draft.scans.some((s) => s.status === 'running');
    if (!anyRunning) {
        const next = draft.scans.find((s) => s.status === 'queued' && !s.attention);
        if (next) {
            next.status = 'running';
            next.started_at = new Date().toISOString();
        }
    }
}

/** A deterministic, recoverable failure scenario: a cloud collector's FIRST pass through
 *  'validating' always hits a transient error (simulating a credential/permission check failing
 *  once) — resumeCollector() retries from 'connecting', and the second pass succeeds because the
 *  statusHistory already shows one 'error' entry. Reproducible, not probabilistic. */
function shouldFailValidation(collector: CollectorRecord): boolean {
    return collector.infraCategory === 'cloud' && !collector.statusHistory.some((h) => h.status === 'error');
}

function runDiscovery(draft: SimState, collector: CollectorRecord): void {
    const org = draft.organisations.find((o) => o.id === collector.orgId);
    const nowIso = draft.clock.nowIso;
    const assets = discoverAssetsForCollector(collector, org?.domain ?? 'onboarded.local', nowIso);
    for (const asset of assets) {
        draft.assets.push(asset);
        draft.servicesByAsset[asset.id] = [];
        draft.techByAsset[asset.id] = [];
        draft.eventsByAsset[asset.id] = [{ id: `evt-${asset.id}`, at: nowIso, event: 'asset_new', details: { source: 'collector', collector_id: collector.id }, asset_id: asset.id }];
        draft.events.push({ id: `evt-feed-onb-${asset.id}`, at: nowIso, event: 'asset_new', details: { source: 'collector', collector_id: collector.id, value: asset.value }, asset_id: asset.id, vms_assets: { value: asset.value, asset_type: asset.asset_type, exposure: asset.exposure } });
        draft.ingestionEvents.push({ id: randomUUID(), collectorId: collector.id, at: nowIso, assetCategory: collector.infraCategory, eventType: 'asset_discovered', processingState: 'applied', normalizedFields: { asset_id: asset.id, value: asset.value, asset_type: asset.asset_type }, assetId: asset.id });
        pushPostureEvent(draft, asset.id, asset.value, 'asset_discovered', null, 'secure', `Discovered by collector "${collector.name}" during onboarding.`);
        collector.assetsDiscovered += 1;
        collector.eventsCollected += 1;
    }
}

function progressCollectors(draft: SimState): void {
    for (const collector of draft.collectors) {
        if (collector.status === 'paused' || collector.status === 'error' || collector.status === 'operational') continue;
        const idx = COLLECTOR_LIFECYCLE.indexOf(collector.status);
        if (idx < 0 || idx >= COLLECTOR_LIFECYCLE.length - 1) continue;
        const next: CollectorStatus = COLLECTOR_LIFECYCLE[idx + 1];
        const nowIso = draft.clock.nowIso;

        if (next === 'collecting' && collector.status === 'validating' && shouldFailValidation(collector)) {
            collector.status = 'error';
            collector.health = 'down';
            collector.errorMessage = 'Cloud credential validation failed — the simulated IAM role check did not confirm read access. Resume to retry.';
            collector.statusHistory.push({ at: nowIso, status: 'error', note: collector.errorMessage });
            continue;
        }

        collector.status = next;
        collector.statusHistory.push({ at: nowIso, status: next });
        collector.lastHeartbeat = nowIso;
        if (next === 'collecting' || next === 'operational') collector.lastSync = nowIso;
        // Collectors mapped to NCC infrastructure discover through syncNccDiscovery(); the generic
        // template discovery remains only for collectors created before mappings existed.
        const nccMapped = draft.collectorMappings.some((m) => m.collectorId === collector.id);
        if (next === 'operational' && collector.assetsDiscovered === 0 && !nccMapped) {
            collector.health = 'healthy';
            runDiscovery(draft, collector);
        }
    }
}

export async function tick(): Promise<void> {
    await advanceClock(TICK_MS);
    await saveState((draft) => {
        progressScans(draft);
        progressCollectors(draft);
        syncNccDiscovery(draft);
    });
}

let started = false;

/** Starts the one process-wide tick interval. Safe to call more than once — only the first call
 *  actually starts the timer (relevant under Next.js dev's hot-reload, which can re-run module init). */
export function startScheduler(): void {
    if (started) return;
    started = true;
    setInterval(() => { void tick(); }, TICK_MS);
}
