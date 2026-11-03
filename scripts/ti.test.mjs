// Unit tests for the Threat Intelligence pages: source freshness wording and TLP/feed markings.
// The Nigeria-specific state map (nigeriaPaths.ts and its map components) was removed — this
// internal single-organization edition has no regional threat map.
//
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, 'node_modules', '.cache', 'ti-test');
mkdirSync(cacheDir, { recursive: true });
async function load(rel, name) {
    const src = join(root, 'frontend', 'src', ...rel.split('/'));
    const out = ts.transpileModule(readFileSync(src, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }, fileName: src });
    writeFileSync(join(cacheDir, `${name}.mjs`), out.outputText);
    return import(pathToFileURL(join(cacheDir, `${name}.mjs`)).href);
}
const ti = await load('lib/ti.ts', 'ti');

test('freshness wording and markings', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    assert.equal(ti.ago(null, now), 'never');
    assert.equal(ti.ago('2026-10-30T11:59:30Z', now), 'just now');
    assert.equal(ti.ago('2026-10-30T11:00:00Z', now), '60 min ago');
    assert.equal(ti.ago('2026-10-30T06:00:00Z', now), '6 h ago');
    assert.equal(ti.ago('2026-10-27T12:00:00Z', now), '3 d ago');
    assert.deepEqual(Object.keys(ti.TLP_LABEL), ['clear', 'green', 'amber', 'amber+strict', 'red']);
    assert.equal(ti.FEED_NAME.opencti, 'OpenCTI (retired)');
});
