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
const files = ['types.ts', 'store.ts', 'scenarios.ts', 'engine.ts', 'generators/assets.ts', 'generators/findings.ts', 'auth/users.ts'];
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

process.chdir(originalCwd);
