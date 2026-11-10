// NCC infrastructure catalogue, collector-to-infrastructure mapping, and endpoint agent package
// verification. Uses a scratch data directory; no real data and no network.
//
//   npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendSrc = join(root, 'backend', 'src');
const cacheDir = join(root, 'node_modules', '.cache', 'collector-mapping-test');
const files = [
    'contracts/ncc-infrastructure.ts', 'contracts/agent-packages.ts', 'contracts/vms.ts',
    'simulation/types.ts', 'simulation/store.ts', 'simulation/scenarios.ts', 'simulation/engine.ts',
    'simulation/generators/assets.ts', 'simulation/generators/findings.ts', 'simulation/generators/onboarding.ts', 'simulation/generators/soc.ts',
    'simulation/auth/users.ts', 'simulation/soc-policy.ts', 'simulation/soc-runtime.ts',
    'simulation/collector-mapping.ts', 'simulation/agent-packages.ts',
];
for (const file of files) {
    const srcPath = join(backendSrc, file);
    const outPath = join(cacheDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    writeFileSync(outPath, out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"));
}

const scratch = join(root, 'node_modules', '.cache', 'collector-mapping-test-cwd');
mkdirSync(scratch, { recursive: true });
rmSync(join(scratch, 'data'), { recursive: true, force: true });
process.env.SIM_DATA_DIR = join(scratch, 'data');

const load = (f) => import(pathToFileURL(join(cacheDir, f)).href);
const catalogue = await load('contracts/ncc-infrastructure.mjs');
const store = await load('simulation/store.mjs');
const engine = await load('simulation/engine.mjs');
const mapping = await load('simulation/collector-mapping.mjs');
const agents = await load('simulation/agent-packages.mjs');

beforeEach(() => store.resetState());

async function newCollector(name = 'core-fw-collector') {
    return engine.createCollector({ name, collectorKind: 'network_telemetry', infraCategory: 'firewall', orgId: 'org-demo-1', businessUnit: '', assetScope: '', collectionIntervalMinutes: 15 });
}

test('catalogue: the 17 NCC register entries, names and types verbatim', () => {
    const items = catalogue.NCC_INFRASTRUCTURE;
    assert.equal(items.length, 17);
    assert.deepEqual(items.map((i) => i.no), Array.from({ length: 17 }, (_, i) => i + 1));
    assert.equal(new Set(items.map((i) => i.id)).size, 17);
    const byNo = Object.fromEntries(items.map((i) => [i.no, i]));
    assert.equal(byNo[1].name, 'ITSM (ServiceDesk Plus)');
    assert.equal(byNo[4].hosting, 'E-Services applications (e.g TAMSY, LAMS, OMS), Staff Payment, Third-party Payment, etc.');
    assert.equal(byNo[9].name, 'Sophos XGS');
    assert.equal(byNo[9].quantity, 2);
    assert.equal(byNo[15].quantity, 24);
    assert.equal(byNo[16].type, 'Aggregation Switch');
    assert.equal(byNo[17].name, 'iMaster NCE CampusInsight');
});

test('mapping: a collector can be mapped, the row carries register data, and a new collector is not "connected"', async () => {
    const c = await newCollector();
    await mapping.createMapping(c.id, 'ncc-infra-12', 'Administrator');
    const { rows } = mapping.listMappingRows(store.loadState());
    const row = rows.find((r) => r.collectorId === c.id);
    assert.ok(row);
    assert.equal(row.infrastructureName, 'Cisco Firepower 3140');
    assert.equal(row.infrastructureType, 'Firewall');
    assert.equal(row.connection.view, 'created');
    assert.equal(row.connection.lastHeartbeatLabel, 'Awaiting first heartbeat');
    assert.equal(row.connection.lastDataLabel, 'No data received');
});

test('mapping: duplicates are refused and unknown infrastructure is rejected', async () => {
    const c = await newCollector();
    await mapping.createMapping(c.id, 'ncc-infra-09', 'Administrator');
    await assert.rejects(() => mapping.createMapping(c.id, 'ncc-infra-09', 'Administrator'), (e) => e.status === 409);
    await assert.rejects(() => mapping.createMapping(c.id, 'not-a-real-item', 'Administrator'), (e) => e.status === 400);
    await assert.rejects(() => mapping.createMapping('missing-collector', 'ncc-infra-09', 'Administrator'), (e) => e.status === 404);
});

test('mapping: one collector can map to several items; update and delete are audited and keep the duplicate rule', async () => {
    const c = await newCollector();
    const a = await mapping.createMapping(c.id, 'ncc-infra-09', 'Administrator');
    await mapping.createMapping(c.id, 'ncc-infra-12', 'Administrator');
    await assert.rejects(() => mapping.updateMapping(a.id, 'ncc-infra-12', 'Administrator'), (e) => e.status === 409);
    await mapping.updateMapping(a.id, 'ncc-infra-13', 'Marcus Hale');
    await mapping.deleteMapping(a.id, 'Marcus Hale');
    const state = store.loadState();
    assert.deepEqual(state.collectorMappings.map((m) => m.infrastructureId), ['ncc-infra-12']);
    const actions = state.auditLog.filter((e) => e.action.startsWith('collector.mapping_')).map((e) => e.action);
    assert.deepEqual(actions, ['collector.mapping_created', 'collector.mapping_created', 'collector.mapping_updated', 'collector.mapping_removed']);
    assert.equal(state.collectorMappings[0].orgId, 'org-demo-1', 'organisation comes from the collector record');
});

test('mapping: survives a reload from disk and is removed with its collector', async () => {
    const c = await newCollector();
    await mapping.createMapping(c.id, 'ncc-infra-14', 'Administrator');
    const onDisk = JSON.parse(readFileSync(join(process.env.SIM_DATA_DIR, 'simulation-state.json'), 'utf8'));
    assert.equal(onDisk.collectorMappings.length, 1);
    await engine.removeCollector(c.id);
    assert.equal(store.loadState().collectorMappings.length, 0);
});

test('connection state: derived from the recorded lifecycle and clock only', () => {
    const base = { status: 'operational', collectionIntervalMinutes: 15, lastHeartbeat: '2026-11-10T10:00:00Z', lastSync: '2026-11-10T10:00:00Z' };
    assert.equal(mapping.connectionStateOf(base, '2026-11-10T10:10:00Z').view, 'connected');
    assert.equal(mapping.connectionStateOf(base, '2026-11-10T11:00:00Z').view, 'stale');
    assert.equal(mapping.connectionStateOf({ ...base, status: 'paused' }, '2026-11-10T10:10:00Z').view, 'offline');
    assert.equal(mapping.connectionStateOf({ ...base, status: 'error' }, '2026-11-10T10:10:00Z').view, 'error');
    assert.equal(mapping.connectionStateOf({ ...base, status: 'connecting', lastHeartbeat: null }, '2026-11-10T10:10:00Z').view, 'registered');
});

test('agent packages: nothing is offered without an approved manifest', () => {
    const listing = agents.listAgentPackages();
    assert.ok(listing.packages.length > 0);
    assert.equal(listing.availableCount, 0);
    assert.ok(listing.packages.every((p) => !p.available && p.reason));
});

test('agent packages: a file is offered only when its SHA-256 matches the manifest', () => {
    const dir = join(root, 'backend', 'artifacts', 'agents');
    if (existsSync(dirname(dir))) return; // never touch a real staging folder
    mkdirSync(dir, { recursive: true });
    try {
        const file = 'endpoint-collector-linux-x64.tar.gz';
        const body = Buffer.from('test artifact, not a real agent');
        writeFileSync(join(dir, file), body);
        const good = createHash('sha256').update(body).digest('hex');
        writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ packages: [{ id: 'endpoint-collector-linux-x64', file, version: '0.0.0-test', sha256: good }] }));
        assert.equal(agents.listAgentPackages().packages.find((p) => p.id === 'endpoint-collector-linux-x64').available, true);
        writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ packages: [{ id: 'endpoint-collector-linux-x64', file, version: '0.0.0-test', sha256: '0'.repeat(64) }] }));
        const bad = agents.listAgentPackages().packages.find((p) => p.id === 'endpoint-collector-linux-x64');
        assert.equal(bad.available, false);
        assert.match(bad.reason, /SHA-256/);
    } finally {
        for (const f of ['endpoint-collector-linux-x64.tar.gz', 'manifest.json']) rmSync(join(dir, f), { force: true });
        if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
        const parent = dirname(dir);
        if (existsSync(parent) && readdirSync(parent).length === 0) rmSync(parent, { recursive: true, force: true });
    }
});

test('agent packages: a download attempt is written to the audit log', async () => {
    await agents.recordAgentDownload('Administrator', 'unavailable', { missing: [] });
    assert.ok(store.loadState().auditLog.some((e) => e.action === 'collector.agent_download_unavailable' && e.actor === 'Administrator'));
});

function readTar(buf) {
    const files = {};
    let off = 0;
    while (off + 512 <= buf.length) {
        const header = buf.subarray(off, off + 512);
        if (header.every((b) => b === 0)) break;
        const name = header.subarray(0, 100).toString('ascii').replace(/\0.*$/s, '');
        const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/s, '').trim(), 8);
        files[name] = buf.subarray(off + 512, off + 512 + size);
        off += 512 + Math.ceil(size / 512) * 512;
    }
    return files;
}

test('agent bundle: no bundle without a verified package; with one, a valid tar with the file, its SHA-256 manifest and instructions', () => {
    assert.equal(agents.buildAgentBundle(), null);
    const dir = join(root, 'backend', 'artifacts', 'agents');
    if (existsSync(dirname(dir))) return; // never touch a real staging folder
    mkdirSync(dir, { recursive: true });
    try {
        const file = 'endpoint-collector-windows-x64.msi';
        const body = Buffer.from('test artifact for bundle check, not a real agent');
        const sha = createHash('sha256').update(body).digest('hex');
        writeFileSync(join(dir, file), body);
        writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ packages: [{ id: 'endpoint-collector-windows-x64', file, version: '0.0.0-test', sha256: sha }] }));
        const bundle = agents.buildAgentBundle(Date.parse('2026-11-10T09:00:00Z'));
        assert.ok(bundle);
        assert.equal(bundle.fileName, 'ncc-endpoint-agents-2026-11-10.tar');
        assert.equal(bundle.data.length % 512, 0);
        const files = readTar(bundle.data);
        assert.deepEqual(Object.keys(files).sort(), ['INSTALL.txt', 'MANIFEST.json', file].sort());
        assert.equal(createHash('sha256').update(files[file]).digest('hex'), sha);
        const manifest = JSON.parse(files['MANIFEST.json'].toString('utf8'));
        assert.deepEqual(manifest.packages.map((p) => [p.file, p.sha256, p.os, p.arch]), [[file, sha, 'windows', 'x64']]);
        assert.match(files['INSTALL.txt'].toString('utf8'), /Nothing has been installed on any endpoint/);
    } finally {
        for (const f of ['endpoint-collector-windows-x64.msi', 'manifest.json']) rmSync(join(dir, f), { force: true });
        if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
        const parent = dirname(dir);
        if (existsSync(parent) && readdirSync(parent).length === 0) rmSync(parent, { recursive: true, force: true });
    }
});
