// Contract tests for src/lib/simulation/ — the persistent engine behind the ported route handlers
// (src/app/api/vms/**, src/app/api/auth/**). Asserts the same "every nested key a component reads
// with a single `?.` hop actually exists" invariant that scripts/demo-router-contract.test.mjs
// checks for the still-unported endpoints, plus that mutations actually persist to disk (the
// whole point of this migration) rather than only living in memory for one request.
//
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src', 'lib', 'simulation');
const cacheDir = join(root, 'node_modules', '.cache', 'simulation-engine-test');
mkdirSync(cacheDir, { recursive: true });

// Every runtime (non-type-only) import inside src/lib/simulation reachable from engine.ts is
// either a relative file in this tree or a Node builtin (node:crypto, node:fs, node:path,
// node:url) — nothing touches next/headers or next/server, so this subtree transpiles and runs
// standalone under plain Node ESM. auth/guard.ts and auth/session.ts (which DO need Next.js'
// request context) are intentionally excluded — engine.ts never imports them.
const files = ['types.ts', 'store.ts', 'scenarios.ts', 'engine.ts', 'clock.ts', 'scheduler.ts', 'generators/assets.ts', 'generators/findings.ts', 'generators/onboarding.ts', 'auth/users.ts'];
for (const file of files) {
    const srcPath = join(srcDir, file);
    const outPath = join(cacheDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    const rewritten = out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'");
    writeFileSync(outPath, rewritten);
}

// store.ts resolves its data directory from process.cwd() — point it at a scratch directory
// so this test never touches the real data/simulation-state.json a running dev server owns.
const scratchCwd = join(root, 'node_modules', '.cache', 'simulation-engine-test-cwd');
mkdirSync(scratchCwd, { recursive: true });
rmSync(join(scratchCwd, 'data'), { recursive: true, force: true });
const originalCwd = process.cwd();
process.chdir(scratchCwd);

const engine = await import(pathToFileURL(join(cacheDir, 'engine.mjs')).href);
const { loadState, resetState } = await import(pathToFileURL(join(cacheDir, 'store.mjs')).href);
const { tick } = await import(pathToFileURL(join(cacheDir, 'scheduler.mjs')).href);

test('seed state: every array a component iterates over actually exists and is non-empty', () => {
    resetState();
    const state = loadState();
    for (const key of ['assets', 'findings', 'scans', 'events', 'users']) {
        assert.ok(Array.isArray(state[key]) && state[key].length > 0, `${key} must be a non-empty array`);
    }
    assert.equal(typeof state.clock.nowIso, 'string');
    assert.equal(typeof state.version, 'number');
});

test('VMS dashboard building blocks: lists/kpis exist so `d?.lists.recent_critical.length` never throws', () => {
    resetState();
    const summary = engine.getFindingsSummary();
    const risk = engine.getRisk();
    const tasks = engine.getTasks();
    const overview = engine.getVmsOverview();
    assert.equal(typeof summary.open, 'number');
    assert.ok(summary.by_severity && typeof summary.by_severity === 'object');
    assert.ok(Array.isArray(risk.queue));
    assert.ok(Array.isArray(risk.trend));
    assert.ok(Array.isArray(tasks));
    assert.equal(typeof overview.assets.active, 'number');
});

test('Asset detail: services/technologies/events exist so a missing key never throws', () => {
    resetState();
    const assets = engine.listAssets();
    assert.ok(assets.length > 0);
    const detail = engine.getAssetDetail(assets[0].id);
    assert.ok(detail);
    assert.ok(Array.isArray(detail.services));
    assert.ok(Array.isArray(detail.technologies));
    assert.ok(Array.isArray(detail.events));
});

test('Finding detail: evidence/events/cve_intel exist so a missing key never throws', () => {
    resetState();
    const state = loadState();
    const detail = engine.findingDetail(state.findings[0].id);
    assert.ok(detail);
    assert.ok(Array.isArray(detail.evidence));
    assert.ok(Array.isArray(detail.events));
    assert.ok(Array.isArray(detail.cve_intel));
});

test('patchAsset actually persists — a mutation survives a fresh loadState(), not just this request', async () => {
    resetState();
    const asset = engine.listAssets()[0];
    await engine.patchAsset(asset.id, { owner: 'Test Owner (contract test)' });
    const reloaded = engine.getAsset(asset.id);
    assert.equal(reloaded.owner, 'Test Owner (contract test)');
});

test('patchFinding actually persists and updates verified_at on verify', async () => {
    resetState();
    const finding = loadState().findings.find((f) => f.status !== 'verified');
    assert.ok(finding, 'fixture must contain at least one non-verified finding');
    const updated = await engine.patchFinding(finding.id, { status: 'verified' });
    assert.equal(updated.status, 'verified');
    assert.ok(updated.verified_at);
    const reloaded = engine.findingDetail(finding.id).finding;
    assert.equal(reloaded.status, 'verified');
});

test('resetState() reseeds deterministically — same shape, same record count', () => {
    const before = resetState();
    const after = resetState();
    assert.equal(before.assets.length, after.assets.length);
    assert.equal(before.findings.length, after.findings.length);
});

// --- P1: organisations, collectors, lifecycle, discovery, posture --------------------------------

test('Organisation isolation: collectors scoped to one org are not returned for another', async () => {
    resetState();
    const orgA = await engine.createOrganisation({ name: 'Org A', domain: 'org-a.test' });
    const orgB = await engine.createOrganisation({ name: 'Org B', domain: 'org-b.test' });
    await engine.createCollector({ name: 'collector-a', collectorKind: 'endpoint', infraCategory: 'servers', orgId: orgA.id, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
    await engine.createCollector({ name: 'collector-b', collectorKind: 'endpoint', infraCategory: 'servers', orgId: orgB.id, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
    assert.equal(engine.listCollectors(orgA.id).length, 1);
    assert.equal(engine.listCollectors(orgB.id).length, 1);
    assert.equal(engine.listCollectors(orgA.id)[0].name, 'collector-a');
});

test('Organisation onboarding: create + update persists, resumable by id', async () => {
    resetState();
    const org = await engine.createOrganisation({ name: 'Resume Test Org', domain: 'resume.test', businessUnits: ['Platform'] });
    assert.equal(org.onboardingComplete, false);
    assert.equal(org.onboardingStep, 1);
    await engine.updateOrganisation(org.id, { onboardingStep: 3, infrastructureCategories: ['servers', 'cloud'] });
    const reloaded = engine.getOrganisation(org.id);
    assert.equal(reloaded.onboardingStep, 3);
    assert.deepEqual(reloaded.infrastructureCategories, ['servers', 'cloud']);
    assert.deepEqual(reloaded.businessUnits, ['Platform']);
});

test('Collector creation: appears immediately in the management list', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const before = engine.listCollectors().length;
    const collector = await engine.createCollector({ name: 'test-collector', collectorKind: 'endpoint', infraCategory: 'servers', orgId: org.id, businessUnit: 'Platform', assetScope: 'test', collectionIntervalMinutes: 15 });
    assert.equal(collector.status, 'created');
    assert.equal(engine.listCollectors().length, before + 1);
    assert.ok(engine.getCollector(collector.id));
});

test('Collector lifecycle: advances on the simulation clock through to operational, then discovers assets exactly once', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const collector = await engine.createCollector({ name: 'lifecycle-collector', collectorKind: 'endpoint', infraCategory: 'servers', orgId: org.id, businessUnit: 'Platform', assetScope: 'test', collectionIntervalMinutes: 15 });
    assert.equal(collector.status, 'created');

    for (let i = 0; i < 6; i++) await tick();
    const operational = engine.getCollector(collector.id);
    assert.equal(operational.status, 'operational');
    assert.ok(operational.assetsDiscovered > 0, 'operational collector must have discovered assets');
    assert.ok(operational.statusHistory.length >= 6, 'every lifecycle step must be recorded');

    const assetsAfterFirstOperational = operational.assetsDiscovered;
    // Further ticks while already operational must NOT discover more assets — no duplicate
    // generation on every refresh.
    await tick();
    await tick();
    const stillOperational = engine.getCollector(collector.id);
    assert.equal(stillOperational.assetsDiscovered, assetsAfterFirstOperational, 'assets must only be discovered once, not on every tick');
});

test('Deliberate failure scenario: a cloud collector fails validation once, then recovers on resume', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const collector = await engine.createCollector({ name: 'cloud-collector', collectorKind: 'api_connector', infraCategory: 'cloud', orgId: org.id, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });

    for (let i = 0; i < 4; i++) await tick(); // created -> configuring -> connecting -> validating -> (error)
    const failed = engine.getCollector(collector.id);
    assert.equal(failed.status, 'error');
    assert.ok(failed.errorMessage, 'an error status must carry an explanation');

    await engine.resumeCollector(collector.id);
    for (let i = 0; i < 6; i++) await tick();
    const recovered = engine.getCollector(collector.id);
    assert.equal(recovered.status, 'operational', 'resuming must let the collector reach operational on the second attempt');
    assert.ok(recovered.statusHistory.some((h) => h.status === 'error'), 'the recovery is reproducible, not a reset of history');
});

test('Pause/resume/remove: collector controls work and persist', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const collector = await engine.createCollector({ name: 'controllable-collector', collectorKind: 'endpoint', infraCategory: 'servers', orgId: org.id, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
    await engine.pauseCollector(collector.id);
    assert.equal(engine.getCollector(collector.id).status, 'paused');
    await tick(); // paused collectors must not advance
    assert.equal(engine.getCollector(collector.id).status, 'paused');
    await engine.resumeCollector(collector.id);
    assert.equal(engine.getCollector(collector.id).status, 'connecting');
    const removed = await engine.removeCollector(collector.id);
    assert.equal(removed, true);
    assert.equal(engine.getCollector(collector.id), null);
});

test('Asset discovery writes real asset records into the shared inventory (not a parallel list)', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const beforeCount = engine.listAssets().length;
    const collector = await engine.createCollector({ name: 'discovery-collector', collectorKind: 'endpoint', infraCategory: 'endpoints', orgId: org.id, businessUnit: 'Platform', assetScope: 'test', collectionIntervalMinutes: 15 });
    for (let i = 0; i < 6; i++) await tick();
    const afterCount = engine.listAssets().length;
    assert.ok(afterCount > beforeCount, 'discovered assets must land in the same listAssets() inventory');
    const discovered = engine.listAssets().filter((a) => a.discovery_sources.includes(`collector:${collector.id}`));
    assert.ok(discovered.length > 0);
    // Every discovered asset must have a stable, unique id — no accidental duplicate ids.
    const ids = discovered.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('Asset criticality change is persisted and produces a posture event', async () => {
    resetState();
    const asset = engine.listAssets().find((a) => a.criticality !== 'critical');
    assert.ok(asset, 'fixture must contain at least one non-critical asset');
    const before = engine.listPostureEvents(asset.id).length;
    await engine.patchAsset(asset.id, { criticality: 'critical' });
    assert.equal(engine.getAsset(asset.id).criticality, 'critical');
    const events = engine.listPostureEvents(asset.id);
    assert.ok(events.length > before, 'a criticality change must be recorded as a posture event');
    assert.equal(events[0].eventType, 'criticality_changed');
});

test('Scan integration scenario: onboarding scan on a clean asset produces exactly one finding and a posture event', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const collector = await engine.createCollector({ name: 'scan-scenario-collector', collectorKind: 'endpoint', infraCategory: 'servers', orgId: org.id, businessUnit: 'Platform', assetScope: 'test', collectionIntervalMinutes: 15 });
    for (let i = 0; i < 6; i++) await tick();
    const discovered = engine.listAssets().find((a) => a.discovery_sources.includes(`collector:${collector.id}`));
    assert.ok(discovered, 'collector must have discovered at least one asset to run this scenario');
    assert.equal(engine.findingsForAsset(discovered.id).length, 0, 'a freshly discovered asset starts with no findings');

    const scan = await engine.startAssetScan(discovered.id);
    assert.equal(scan.status, 'queued');
    assert.equal(scan.target_asset_id, discovered.id);

    // Advance until the scan completes (queued -> running -> succeeded takes a few ticks).
    let completed = null;
    for (let i = 0; i < 10 && !completed; i++) {
        await tick();
        completed = loadState().scans.find((s) => s.id === scan.id && s.status === 'succeeded');
    }
    assert.ok(completed, 'the onboarding scan must reach succeeded within a bounded number of ticks');

    const findings = engine.findingsForAsset(discovered.id);
    assert.equal(findings.length, 1, 'exactly one finding must be generated — never duplicated on later ticks');
    const posture = engine.listPostureEvents(discovered.id);
    assert.ok(posture.some((e) => e.eventType === 'vulnerability_identified'));

    // A further tick must not generate a second finding for the same asset.
    await tick();
    assert.equal(engine.findingsForAsset(discovered.id).length, 1);
});

test('Posture summary: portfolio counts are derived from, and consistent with, per-asset posture', () => {
    resetState();
    const summary = engine.getPostureSummary();
    assert.equal(typeof summary.total_assets, 'number');
    const sum = Object.values(summary.by_posture).reduce((a, b) => a + b, 0);
    assert.equal(sum, summary.total_assets, 'every asset must be counted in exactly one posture bucket');
    assert.ok(Array.isArray(summary.trend));
});

test('Authorization: invites can only be created with a role the sidebar actually recognizes', async () => {
    resetState();
    const invite = await engine.createInvite('new.analyst@ncc-soc.demo', 'analyst', 'Administrator');
    assert.equal(invite.role, 'analyst');
    assert.ok(['super_admin', 'soc_manager', 'analyst', 'executive', 'portal_user'].includes(invite.role));
});

test('Persistence: collectors and posture events survive a fresh loadState() after a mutation', async () => {
    resetState();
    const org = engine.listOrganisations()[0];
    const collector = await engine.createCollector({ name: 'persistence-check', collectorKind: 'endpoint', infraCategory: 'servers', orgId: org.id, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
    await tick();
    const reread = loadState().collectors.find((c) => c.id === collector.id);
    assert.ok(reread, 'the collector must be readable from a completely fresh loadState() call');
    assert.ok(reread.statusHistory.length >= 2);
});

process.chdir(originalCwd);
