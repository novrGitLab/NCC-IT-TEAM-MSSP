// Simulated NCC asset discovery. Keeps the shared asset inventory consistent with the collector
// mappings: one asset per (organisation, NCC infrastructure item), reported by every operational
// collector mapped to that item. Pure over a SimState draft and idempotent: running it again with the
// same state changes nothing, so scheduler ticks, page refreshes and restarts never duplicate assets.
// Every record it writes is marked simulated. No device is contacted and no address is invented.
import { randomUUID } from 'node:crypto';
import { nccInfrastructureById, type NccInfrastructureItem } from '../contracts/ncc-infrastructure';
import type { VmsAsset } from '../contracts/vms';
import type { CollectorRecord, SimState } from './types';

export const SIMULATED_SOURCE = 'simulated_collector';
const collectorSource = (collectorId: string) => `collector:${collectorId}`;

/** Stable asset id for an organisation's NCC infrastructure item. */
export function nccAssetId(orgId: string, infrastructureId: string): string {
    return `asset-ncc-${orgId}-${infrastructureId}`;
}

/** Representative asset name, clearly marked simulated; never a real hostname or address. */
export function nccAssetName(item: NccInfrastructureItem): string {
    const slug = item.name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `sim-ncc-${String(item.no).padStart(2, '0')}-${slug}`;
}

function criticalityFor(item: NccInfrastructureItem): VmsAsset['criticality'] {
    if (['Firewall', 'EDGE Router', 'Core Switch'].includes(item.type)) return 'critical';
    if (item.type === 'Networking Monitoring Tool') return 'medium';
    return 'high';
}

function newAsset(item: NccInfrastructureItem, orgId: string, nowIso: string): VmsAsset {
    const value = nccAssetName(item);
    return {
        id: nccAssetId(orgId, item.id),
        asset_type: item.engineCategory === 'endpoints' ? 'endpoint' : 'host',
        value,
        hostnames: [value],
        ips: [],
        dns: {},
        http: null,
        exposure: item.engineCategory === 'cloud' ? 'unknown' : 'internal',
        alive: true,
        owner: null,
        criticality: criticalityFor(item),
        wazuh_agent_id: null,
        discovery_sources: [SIMULATED_SOURCE],
        first_seen: nowIso,
        last_seen: nowIso,
        status: 'active',
        org_id: orgId,
        simulated: true,
        ncc: { infrastructure_id: item.id, no: item.no, name: item.name, type: item.type, hosting: item.hosting, quantity: item.quantity },
    };
}

function feedEvent(draft: SimState, asset: VmsAsset, event: 'asset_new' | 'asset_gone', details: Record<string, unknown>, nowIso: string): void {
    const entry = { id: `evt-${event}-${asset.id}-${randomUUID().slice(0, 8)}`, at: nowIso, event, details: { simulated: true, ...details }, asset_id: asset.id };
    (draft.eventsByAsset[asset.id] ??= []).push(entry);
    draft.events.push({ ...entry, vms_assets: { value: asset.value, asset_type: asset.asset_type, exposure: asset.exposure } });
}

export interface DiscoverySyncResult { discovered: number; released: number }

/** Brings assets in line with mappings at clock value `nowIso`. Safe to call any number of times. */
export function syncNccDiscovery(draft: SimState, nowIso: string = draft.clock.nowIso): DiscoverySyncResult {
    const result: DiscoverySyncResult = { discovered: 0, released: 0 };
    const collectors = new Map(draft.collectors.map((c) => [c.id, c]));

    // 1. Operational collectors discover the assets for every NCC item they are mapped to.
    for (const m of draft.collectorMappings) {
        const c = collectors.get(m.collectorId);
        const item = nccInfrastructureById(m.infrastructureId);
        if (!c || !item || c.status !== 'operational') continue;
        const id = nccAssetId(c.orgId, item.id);
        let asset = draft.assets.find((a) => a.id === id);
        let created = false;
        if (!asset) {
            asset = newAsset(item, c.orgId, nowIso);
            draft.assets.push(asset);
            draft.servicesByAsset[asset.id] ??= [];
            draft.techByAsset[asset.id] ??= [];
            draft.postureEvents.push({ id: randomUUID(), at: nowIso, assetId: asset.id, assetValue: asset.value, eventType: 'asset_discovered', previousPosture: null, newPosture: 'secure', explanation: `Simulated discovery by collector "${c.name}" (${item.name}).` });
            created = true;
        }
        const src = collectorSource(c.id);
        if (!asset.discovery_sources.includes(src)) {
            asset.discovery_sources.push(src);
            draft.ingestionEvents.push({
                id: randomUUID(), collectorId: c.id, at: nowIso, assetCategory: item.type, eventType: 'asset_discovered', processingState: 'applied',
                normalizedFields: { simulated: true, asset_id: asset.id, value: asset.value, ncc_infrastructure_id: item.id, ncc_infrastructure: item.name },
                assetId: asset.id,
            });
            c.eventsCollected += 1;
            if (created) feedEvent(draft, asset, 'asset_new', { source: 'simulated_collector', collector_id: c.id, ncc_infrastructure: item.name }, nowIso);
            result.discovered += 1;
        }
        if (asset.status !== 'active') {
            asset.status = 'active';
            feedEvent(draft, asset, 'asset_new', { source: 'simulated_collector', collector_id: c.id, reason: 'reported again' }, nowIso);
        }
        asset.alive = true;
        asset.last_seen = nowIso;
    }

    // 2. Drop reporters whose mapping or collector no longer exists; an asset left with no reporter
    //    is marked gone (kept, never deleted). Assets not produced by simulated discovery are untouched.
    for (const asset of draft.assets) {
        if (!asset.simulated || !asset.ncc) continue;
        const infraId = asset.ncc.infrastructure_id;
        const kept = asset.discovery_sources.filter((s) => {
            if (!s.startsWith('collector:')) return true;
            const id = s.slice('collector:'.length);
            return collectors.has(id) && draft.collectorMappings.some((m) => m.collectorId === id && m.infrastructureId === infraId);
        });
        if (kept.length !== asset.discovery_sources.length) {
            asset.discovery_sources = kept;
            result.released += 1;
        }
        const reporters = kept.filter((s) => s.startsWith('collector:')).map((s) => collectors.get(s.slice('collector:'.length))!);
        asset.alive = reporters.some((r) => r.status === 'operational');
        if (reporters.length === 0 && asset.status === 'active') {
            asset.status = 'gone';
            feedEvent(draft, asset, 'asset_gone', { reason: 'No collector is mapped to this infrastructure any more.' }, nowIso);
        }
    }

    // 3. Collector counters and simulated heartbeat for operational collectors.
    for (const c of draft.collectors) {
        const src = collectorSource(c.id);
        c.assetsDiscovered = draft.assets.filter((a) => a.discovery_sources.includes(src)).length;
        if (c.status === 'operational' && draft.collectorMappings.some((m) => m.collectorId === c.id)) {
            c.lastHeartbeat = nowIso;
            c.lastSync = nowIso;
        }
    }
    return result;
}

/** Adds read-only discovery details (reporting collectors, reporting state) to simulated assets. */
export function withDiscoveryView(state: Pick<SimState, 'collectors'>, assets: VmsAsset[]): VmsAsset[] {
    const collectors = new Map(state.collectors.map((c) => [c.id, c]));
    return assets.map((a) => {
        if (!a.simulated) return a;
        const reporters = a.discovery_sources
            .filter((s) => s.startsWith('collector:'))
            .map((s) => collectors.get(s.slice('collector:'.length)))
            .filter((c): c is CollectorRecord => !!c)
            .map((c) => ({ id: c.id, name: c.name, status: c.status }));
        return { ...a, discovery: { source: 'Simulated Collector', collectors: reporters, health: reporters.some((r) => r.status === 'operational') ? 'reporting' : 'not_reporting' } };
    });
}

/** Latest simulated discovery time for a collector, from its ingestion events. */
export function lastDiscoveryAt(state: Pick<SimState, 'ingestionEvents'>, collectorId: string): string | null {
    let latest: string | null = null;
    for (const e of state.ingestionEvents) if (e.collectorId === collectorId && e.eventType === 'asset_discovered' && (!latest || e.at > latest)) latest = e.at;
    return latest;
}

