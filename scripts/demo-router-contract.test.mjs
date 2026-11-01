// Contract tests for src/lib/demo/router.ts — the single place every page's data comes from in
// this demonstration build. These exist because the actual bug class found in this sprint was
// never "the component crashed" in the abstract: it was always a specific endpoint whose response
// was missing a key a component reads with a single `?.` hop (e.g. `data?.summary.error`,
// `s?.scopes.active`) — safe only when that key truly exists. A render-level test would need a
// browser/DOM environment this project doesn't have configured; this instead asserts the actual
// response SHAPE for every endpoint fixed in this pass, which is exactly what would have caught
// each crash before it shipped. Substitutes for, does not replace, real browser verification.
//
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src', 'lib', 'demo');
const cacheDir = join(root, 'node_modules', '.cache', 'demo-router-contract-test');
mkdirSync(cacheDir, { recursive: true });

// Transpile every file in src/lib/demo/ (they only import *types* from outside this folder, which
// transpileModule erases) and rewrite their relative imports to point at the .mjs output so plain
// Node ESM can resolve them without a bundler. assets.ts/vulnerabilities.ts/auth.ts were migrated
// to src/lib/simulation/ (real route handlers + engine.ts now serve those paths — see
// scripts/simulation-engine.test.mjs) and no longer exist here.
const files = ['alerts.ts', 'incidents.ts', 'threats.ts', 'reports.ts', 'collectors.ts', 'nigeria.ts', 'router.ts'];
for (const file of files) {
    const srcPath = join(srcDir, file);
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    const rewritten = out.outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
    writeFileSync(join(cacheDir, file.replace(/\.ts$/, '.mjs')), rewritten);
}
const { demoRespond } = await import(pathToFileURL(join(cacheDir, 'router.mjs')).href);

const get = (path, query = new URLSearchParams()) => demoRespond('GET', path, query, undefined);

test('Nigeria threat map: summary exists so `data?.summary.error` never throws', () => {
    const { status, data } = get('/api/dashboard/nigeria-threats');
    assert.equal(status, 200);
    assert.ok(data.summary, 'summary must exist');
    assert.ok(Array.isArray(data.states));
    assert.equal(typeof data.summary.states_affected, 'number');
    assert.equal(data.summary.states_affected, data.states.filter((s) => s.threats > 0).length, 'states_affected must match the states array, not drift from it');
});

test('VMS operations: queue exists so `ops.data?.queue.queued` never throws', () => {
    const { status, data } = get('/api/vms/operations');
    assert.equal(status, 200);
    assert.ok(data.queue, 'queue must exist');
    assert.equal(typeof data.queue.queued, 'number');
    assert.ok(Array.isArray(data.engines));
});

test('TI overview: indicators and matches exist so `ov.data?.indicators.active`/`matches.new` never throw', () => {
    const { status, data } = get('/api/ti/overview');
    assert.equal(status, 200);
    assert.ok(data.indicators);
    assert.equal(typeof data.indicators.active, 'number');
    assert.ok(data.matches);
    assert.equal(typeof data.matches.new, 'number');
    assert.ok(Array.isArray(data.feeds));
});

test('Push status: runtime exists so `s?.runtime.not_started_reason` never throws', () => {
    const { status, data } = get('/api/admin/push-status');
    assert.equal(status, 200);
    assert.ok(data.runtime, 'runtime must exist');
    assert.ok('not_started_reason' in data.runtime);
});

test('Unmatched GET never returns undefined where a caller reads a nested key without full chaining', () => {
    const { status, data } = get('/api/something/not-wired');
    assert.equal(status, 200);
    assert.deepEqual(data, {}, 'unmatched GET stays an honest empty object, not a fabricated shape');
});

test('Unmatched POST returns an honest failure, never a fake 200 success', () => {
    const { status, data } = demoRespond('POST', '/api/something/not-wired', new URLSearchParams(), {});
    assert.equal(status, 501);
    assert.equal(data.demo, true);
});
