// Workspace layout: the backend package is a plain importable domain package (no Next.js, no
// frontend imports), the frontend reaches it only through its declared exports, the presentation
// sign-in bypass stays removed, and the state file resolves to the workspace root data directory
// no matter which directory the server is started from.
//
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendSrc = join(root, 'backend', 'src');

const outDirShared = join(root, 'node_modules', '.cache', 'workspace-layout-test');
function transpileChain() {
    const outDir = outDirShared;
    mkdirSync(outDir, { recursive: true });
const chain = ['types.ts', 'store.ts', 'scenarios.ts', 'generators/assets.ts', 'generators/findings.ts', 'generators/onboarding.ts', 'generators/soc.ts', 'auth/users.ts', 'soc-policy.ts', 'soc-runtime.ts', 'soc-store.ts'];
for (const file of chain) {
    const srcPath = join(backendSrc, 'simulation', file);
    const outPath = join(outDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    writeFileSync(outPath, out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"));
}
    return outDir;
}

function sourceFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) sourceFiles(p, out);
        else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
}

test('backend package declares its importable subpath exports and workspace name', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'backend', 'package.json'), 'utf8'));
    assert.equal(pkg.name, '@ncc-it/backend');
    assert.equal(pkg.exports['./*'], './src/*.ts');
    assert.ok(pkg.exports['.']);
    const workspaces = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces;
    assert.deepEqual(workspaces, ['frontend', 'backend']);
});

test('backend index re-exports only modules that exist inside the backend', () => {
    const index = readFileSync(join(backendSrc, 'index.ts'), 'utf8');
    const targets = [...index.matchAll(/export \* from '(\.[^']+)';/g)].map((m) => m[1]);
    assert.ok(targets.length > 0);
    for (const t of targets) assert.ok(existsSync(join(backendSrc, `${t}.ts`)), `${t} must exist in backend/src`);
});

test('backend source is server-only domain code: no Next.js, no React, no frontend imports', () => {
    for (const file of sourceFiles(backendSrc)) {
        const text = readFileSync(file, 'utf8');
        const rel = file.slice(root.length + 1);
        assert.doesNotMatch(text, /from '(next\/|next'|react|@\/)/, `${rel} must not import Next.js, React or the frontend alias`);
        assert.doesNotMatch(text, /from '[^']*frontend\//, `${rel} must not reach into the frontend folder`);
    }
});

test('frontend reaches the backend only through its package name, never by deep relative paths', () => {
    const frontendSrc = join(root, 'frontend', 'src');
    for (const file of sourceFiles(frontendSrc)) {
        const text = readFileSync(file, 'utf8');
        assert.doesNotMatch(text, /from '(\.\.\/)+backend\//, `${file.slice(root.length + 1)} must import via @ncc-it/backend`);
    }
});

test('the presentation sign-in bypass is not present in the sign-in handler', () => {
    const handler = readFileSync(join(root, 'frontend', 'src', 'app', 'api', 'auth', 'signin', 'route.ts'), 'utf8');
    assert.doesNotMatch(handler, /NCC_PRESENTATION_MODE/);
    assert.doesNotMatch(handler, /localPresentation/);
});

test('the state file resolves to the workspace root data directory regardless of the start directory', { skip: !existsSync(join(root, 'data', 'simulation-state.json')) && 'no local state file at data/simulation-state.json' }, () => {
    const outDir = transpileChain();
    const storeUrl = pathToFileURL(join(outDir, 'store.mjs')).href;
    const env = { ...process.env };
    delete env.SIM_DATA_DIR;
    const probe = `import { loadState } from ${JSON.stringify(storeUrl)}; console.log(String(loadState().assets.length));`;
    const expected = JSON.parse(readFileSync(join(root, 'data', 'simulation-state.json'), 'utf8')).assets.length;
    for (const cwd of [root, join(root, 'frontend')]) {
        const run = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd, env, encoding: 'utf8' });
        assert.equal(run.status, 0, run.stderr);
        assert.equal(Number(run.stdout.trim()), expected, `state read from ${cwd} must be the root data/simulation-state.json`);
    }
});

test('no default administrator password: a fresh state without SEED_ADMIN_PASSWORD has no super admin and no known password', () => {
    const outDir = transpileChain();
    const storeUrl = pathToFileURL(join(outDir, 'store.mjs')).href;
    const usersUrl = pathToFileURL(join(outDir, 'auth', 'users.mjs')).href;
    const scratchData = join(outDir, 'no-seed-password-data');
    rmSync(scratchData, { recursive: true, force: true });
    const env = { ...process.env, SIM_DATA_DIR: scratchData };
    delete env.SEED_ADMIN_PASSWORD;
    const probe = `import { loadState } from ${JSON.stringify(storeUrl)};
import { verifyPassword } from ${JSON.stringify(usersUrl)};
const s = loadState();
const admins = s.users.filter((u) => u.role === 'super_admin');
const knownHit = s.users.some((u) => verifyPassword('change-me-now', u.passwordHash));
console.log(JSON.stringify({ admins: admins.length, knownHit }));`;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: join(root, 'frontend'), env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout.trim());
    assert.equal(result.admins, 0);
    assert.equal(result.knownHit, false);
});
