// Simulated NCC asset discovery: collectors mapped to NCC infrastructure report assets into the shared
// inventory once operational, idempotently, per organisation. Uses a scratch data directory and the
// real scheduler tick; no network and no real devices.
//
//   npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendSrc = join(root, 'backend', 'src');
const cacheDir = join(root, 'node_modules', '.cache', 'ncc-discovery-test');
const files = [
    'contracts/ncc-infrastructure.ts', 'contracts/agent-packages.ts', 'contracts/vms.ts',
    'simulation/types.ts', 'simulation/store.ts', 'simulation/scenarios.ts', 'simulation/engine.ts', 'simulation/clock.ts', 'simulation/scheduler.ts',
    'simulation/generators/assets.ts', 'simulation/generators/findings.ts', 'simulation/generators/onboarding.ts', 'simulation/generators/soc.ts',
    'simulation/auth/users.ts', 'simulation/soc-policy.ts', 'simulation/soc-runtime.ts',
    'simulation/collector-mapping.ts', 'simulation/ncc-discovery.ts',
];
for (const file of files) {
    const srcPath = join(backendSrc, file);
    const outPath = join(cacheDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    writeFileSync(outPath, out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"));
}
const scratch = join(root, 'node_modules', '.cache', 'ncc-discovery-test-data');
rmSync(scratch, { recursive: true, force: true });
process.env.SIM_DATA_DIR = scratch;

const load = (f) => import(pathToFileURL(join(cacheDir, f)).href);
const store = await load('simulation/store.mjs');
const engine = await load('simulation/engine.mjs');
const mapping = await load('simulation/collector-mapping.mjs');
const discovery = await load('simulation/ncc-discovery.mjs');
const scheduler = await load('simulation/scheduler.mjs');
const catalogue = await load('contracts/ncc-infrastructure.mjs');

beforeEach(() => store.resetState());

const ORG = 'org-demo-1';
async function makeCollector(name, infraIds, orgId = ORG) {
    const c = await engine.createCollector({ name, collectorKind: 'network_telemetry', infraCategory: 'network', orgId, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
    for (const id of infraIds) await mapping.createMapping(c.id, id, 'Administrator');
    return c;
}
async function setStatus(id, status) {
    await store.saveState((d) => { d.collectors.find((c) => c.id === id).status = status; discovery.syncNccDiscovery(d); });
}
const nccAssets = () => store.loadState().assets.filter((a) => a.simulated && a.ncc);
const simulatedEvents = () => store.loadState().ingestionEvents.filter((e) => e.normalizedFields?.simulated === true);

test('a new collector discovers nothing until it is operational, then one simulated asset per mapped item', async () => {
    const c = await makeCollector('core-net', ['ncc-infra-09', 'ncc-infra-12', 'ncc-infra-14']);
    assert.equal(nccAssets().length, 0, 'created collectors do not report');
    await setStatus(c.id, 'operational');
    const assets = nccAssets();
    assert.deepEqual(assets.map((a) => a.ncc.name).sort(), ['Cisco Catalyst 9500', 'Cisco Firepower 3140', 'Sophos XGS']);
    for (const a of assets) {
        assert.equal(a.simulated, true);
        assert.ok(a.discovery_sources.includes(`collector:${c.id}`));
        assert.equal(a.org_id, ORG);
        assert.match(a.value, /^sim-ncc-\d\d-/);
        assert.deepEqual(a.ips, [], 'no address is invented');
    }
    assert.equal(store.loadState().collectors.find((x) => x.id === c.id).assetsDiscovered, 3);
    assert.equal(simulatedEvents().filter((e) => e.collectorId === c.id).length, 3);
});

test('no duplicates: repeated syncs, scheduler ticks and a reload from disk keep the same assets and events', async () => {
    const c = await makeCollector('fw', ['ncc-infra-09']);
    await setStatus(c.id, 'operational');
    const before = { assets: store.loadState().assets.length, events: simulatedEvents().length };
    for (let i = 0; i < 3; i++) await store.saveState((d) => discovery.syncNccDiscovery(d));
    for (let i = 0; i < 3; i++) await scheduler.tick();
    const onDisk = JSON.parse(readFileSync(join(scratch, 'simulation-state.json'), 'utf8'));
    assert.equal(onDisk.assets.length, before.assets);
    assert.equal(onDisk.ingestionEvents.filter((e) => e.normalizedFields?.simulated === true).length, before.events);
    assert.equal(nccAssets().length, 1);
});

test('the real scheduler lifecycle reaches operational and discovers mapped assets, not template assets', async () => {
    const c = await makeCollector('sched', ['ncc-infra-03', 'ncc-infra-04']);
    for (let i = 0; i < 8; i++) await scheduler.tick();
    const state = store.loadState();
    assert.equal(state.collectors.find((x) => x.id === c.id).status, 'operational');
    assert.deepEqual(nccAssets().map((a) => a.ncc.name).sort(), ['Linux VPS', 'Windows VPS']);
    assert.equal(state.assets.filter((a) => a.id.startsWith(`asset-onb-${c.id}`)).length, 0, 'no generic template assets for an NCC-mapped collector');
    assert.equal(state.collectors.find((x) => x.id === c.id).lastHeartbeat, state.clock.nowIso, 'operational collectors keep a simulated heartbeat');
});

test('a simulated validation error recovers through resume and then discovers', async () => {
    const c = await engine.createCollector({ name: 'itsm', collectorKind: 'api_connector', infraCategory: 'cloud', orgId: ORG, businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
    await mapping.createMapping(c.id, 'ncc-infra-01', 'Administrator');
    for (let i = 0; i < 8; i++) await scheduler.tick();
    assert.equal(store.loadState().collectors.find((x) => x.id === c.id).status, 'error');
    assert.equal(nccAssets().length, 0);
    await engine.resumeCollector(c.id);
    for (let i = 0; i < 8; i++) await scheduler.tick();
    assert.equal(store.loadState().collectors.find((x) => x.id === c.id).status, 'operational');
    assert.deepEqual(nccAssets().map((a) => a.ncc.name), ['ITSM (ServiceDesk Plus)']);
});

test('adding a mapping to an operational collector discovers immediately; removing it releases only that association', async () => {
    const a = await makeCollector('a', ['ncc-infra-09']);
    const b = await makeCollector('b', ['ncc-infra-09']);
    await setStatus(a.id, 'operational');
    await setStatus(b.id, 'operational');
    assert.equal(nccAssets().length, 1, 'two collectors on one item share one asset');
    assert.equal(nccAssets()[0].discovery_sources.filter((s) => s.startsWith('collector:')).length, 2);

    const added = await mapping.createMapping(a.id, 'ncc-infra-10', 'Administrator');
    assert.ok(nccAssets().some((x) => x.ncc.infrastructure_id === 'ncc-infra-10' && x.discovery_sources.includes(`collector:${a.id}`)));

    const aMap = store.loadState().collectorMappings.find((m) => m.collectorId === a.id && m.infrastructureId === 'ncc-infra-09');
    await mapping.deleteMapping(aMap.id, 'Administrator');
    const shared = nccAssets().find((x) => x.ncc.infrastructure_id === 'ncc-infra-09');
    assert.equal(shared.status, 'active', 'still reported by collector b');
    assert.ok(!shared.discovery_sources.includes(`collector:${a.id}`));
    assert.ok(shared.discovery_sources.includes(`collector:${b.id}`));

    await mapping.deleteMapping(added.id, 'Administrator');
    const orphan = nccAssets().find((x) => x.ncc.infrastructure_id === 'ncc-infra-10');
    assert.ok(orphan, 'the record is kept, not deleted');
    assert.equal(orphan.status, 'gone');
    assert.equal(store.loadState().collectors.find((x) => x.id === a.id).assetsDiscovered, 0);
});

test('deleting a collector removes its associations and leaves unrelated inventory untouched', async () => {
    const before = store.loadState().assets.filter((a) => !a.simulated).map((a) => a.id).sort();
    const c = await makeCollector('to-delete', ['ncc-infra-15']);
    await setStatus(c.id, 'operational');
    await engine.removeCollector(c.id);
    const state = store.loadState();
    assert.deepEqual(state.assets.filter((a) => !a.simulated).map((a) => a.id).sort(), before);
    const asset = nccAssets().find((x) => x.ncc.infrastructure_id === 'ncc-infra-15');
    assert.equal(asset.status, 'gone');
    assert.equal(asset.discovery_sources.some((s) => s === `collector:${c.id}`), false);
    assert.equal(state.collectorMappings.some((m) => m.collectorId === c.id), false);
});

test('a paused collector keeps its association but its assets stop reporting', async () => {
    const c = await makeCollector('pausable', ['ncc-infra-08']);
    await setStatus(c.id, 'operational');
    await engine.pauseCollector(c.id);
    await store.saveState((d) => discovery.syncNccDiscovery(d));
    const a = nccAssets()[0];
    assert.equal(a.status, 'active');
    assert.equal(a.alive, false);
    assert.equal(discovery.withDiscoveryView(store.loadState(), [a])[0].discovery.health, 'not_reporting');
});

test('organisations are isolated: the same NCC item in two organisations gives two separate assets', async () => {
    await store.saveState((d) => { d.organisations.push({ ...d.organisations[0], id: 'org-two', name: 'Second org' }); });
    const a = await makeCollector('org1', ['ncc-infra-02']);
    const b = await makeCollector('org2', ['ncc-infra-02'], 'org-two');
    await setStatus(a.id, 'operational');
    await setStatus(b.id, 'operational');
    const assets = nccAssets();
    assert.equal(assets.length, 2);
    assert.deepEqual(assets.map((x) => x.org_id).sort(), ['org-demo-1', 'org-two']);
    for (const x of assets) assert.equal(x.discovery_sources.filter((s) => s.startsWith('collector:')).length, 1);
});

test('seven collectors covering the 17 NCC items produce all 17 categories, each reported by its own collector', async () => {
    const groups = [
        ['ncc-infra-01', 'ncc-infra-02'],
        ['ncc-infra-03', 'ncc-infra-04'],
        ['ncc-infra-05', 'ncc-infra-06', 'ncc-infra-07'],
        ['ncc-infra-08', 'ncc-infra-17'],
        ['ncc-infra-09', 'ncc-infra-12', 'ncc-infra-13'],
        ['ncc-infra-10', 'ncc-infra-11'],
        ['ncc-infra-14', 'ncc-infra-15', 'ncc-infra-16'],
    ];
    const collectors = [];
    for (const [i, g] of groups.entries()) collectors.push(await makeCollector(`collector-${i + 1}`, g));
    for (const c of collectors) await setStatus(c.id, 'operational');
    const assets = nccAssets();
    assert.equal(assets.length, 17);
    assert.deepEqual(assets.map((a) => a.ncc.no).sort((x, y) => x - y), catalogue.NCC_INFRASTRUCTURE.map((i) => i.no));
    const state = store.loadState();
    for (const [i, c] of collectors.entries()) assert.equal(state.collectors.find((x) => x.id === c.id).assetsDiscovered, groups[i].length);
    assert.equal(assets.find((a) => a.ncc.no === 15).ncc.quantity, 24, 'quantity is metadata; one asset represents the category');
});
