// Administrator seeding (backend/src/simulation/scenarios.ts ensureAdministrator): the account is created
// from the environment, an existing account keeps its stored password unless ADMIN_PASSWORD_RESET=true,
// the reset ends that administrator's sessions only, and no password is ever printed.
//
//   npm test
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'backend', 'src', 'simulation');
const outDir = join(root, 'node_modules', '.cache', 'admin-seed-test');
const files = ['types.ts', 'scenarios.ts', 'generators/assets.ts', 'generators/findings.ts', 'generators/onboarding.ts', 'generators/soc.ts', 'auth/users.ts'];
for (const file of files) {
    const srcPath = join(srcRoot, file);
    const outPath = join(outDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    writeFileSync(outPath, out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"));
}
const scenarios = await import(pathToFileURL(join(outDir, 'scenarios.mjs')).href);
const users = await import(pathToFileURL(join(outDir, 'auth', 'users.mjs')).href);

const ENV = ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD', 'ADMIN_PASSWORD_RESET'];
const saved = {};
const OLD = 'old-admin-passphrase-001';
const NEW = 'new-admin-passphrase-002';
let warnings;
const realWarn = console.warn;

beforeEach(() => {
    for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
    warnings = [];
    console.warn = (...args) => warnings.push(args.join(' '));
});
afterEach(() => {
    console.warn = realWarn;
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

function baseState() {
    return {
        users: [
            { id: 'u-portal', email: 'client@ncc-soc.demo', passwordHash: users.hashPassword('portal-passphrase-003'), role: 'portal_user', orgId: 'org-1', name: 'Client', createdAt: '2026-01-01T00:00:00Z', disabled: false },
            { id: 'u-analyst', email: 'analyst@example.test', passwordHash: users.hashPassword('analyst-passphrase-004'), role: 'analyst', orgId: null, name: 'Analyst', createdAt: '2026-01-01T00:00:00Z', disabled: false },
        ],
        sessions: [
            { id: 's-admin', userId: 'u-admin', createdAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' },
            { id: 's-other', userId: 'u-analyst', createdAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' },
        ],
    };
}
function withAdmin(state, password) {
    state.users.push({ id: 'u-admin', email: 'admin@ncc-it.local', passwordHash: users.hashPassword(password), role: 'super_admin', orgId: null, name: 'Administrator', createdAt: '2026-01-01T00:00:00Z', disabled: false });
    return state;
}

test('without SEED_ADMIN_PASSWORD no account is created and no default password appears', () => {
    const state = baseState();
    assert.equal(scenarios.ensureAdministrator(state), false);
    assert.equal(state.users.some((u) => u.role === 'super_admin'), false);
});

test('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD create the administrator when it is missing', () => {
    process.env.SEED_ADMIN_EMAIL = 'Admin@NCC-IT.local';
    process.env.SEED_ADMIN_PASSWORD = NEW;
    const state = baseState();
    assert.equal(scenarios.ensureAdministrator(state), true);
    const admin = state.users.find((u) => u.role === 'super_admin');
    assert.equal(admin.email, 'admin@ncc-it.local');
    assert.equal(users.verifyPassword(NEW, admin.passwordHash), true);
});

test('an existing administrator with the configured password is left unchanged', () => {
    process.env.SEED_ADMIN_EMAIL = 'admin@ncc-it.local';
    process.env.SEED_ADMIN_PASSWORD = NEW;
    const state = withAdmin(baseState(), NEW);
    const before = JSON.stringify(state);
    assert.equal(scenarios.ensureAdministrator(state), false);
    assert.equal(JSON.stringify(state), before);
    assert.equal(warnings.length, 0);
});

test('a configured password that differs from the stored one is kept, reported, and never printed', () => {
    process.env.SEED_ADMIN_EMAIL = 'admin@ncc-it.local';
    process.env.SEED_ADMIN_PASSWORD = NEW;
    const state = withAdmin(baseState(), OLD);
    assert.equal(scenarios.ensureAdministrator(state), false);
    assert.equal(users.verifyPassword(OLD, state.users.find((u) => u.id === 'u-admin').passwordHash), true);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ADMIN_PASSWORD_RESET=true/);
    assert.equal(warnings[0].includes(NEW) || warnings[0].includes(OLD), false, 'the warning must not contain either password');
});

test('ADMIN_PASSWORD_RESET=true applies the configured password, ends only that administrator\'s sessions, and touches nothing else', () => {
    process.env.SEED_ADMIN_EMAIL = 'admin@ncc-it.local';
    process.env.SEED_ADMIN_PASSWORD = NEW;
    process.env.ADMIN_PASSWORD_RESET = 'true';
    const state = withAdmin(baseState(), OLD);
    const otherUsers = JSON.stringify(state.users.filter((u) => u.id !== 'u-admin'));
    assert.equal(scenarios.ensureAdministrator(state), true);
    const admin = state.users.find((u) => u.id === 'u-admin');
    assert.equal(users.verifyPassword(NEW, admin.passwordHash), true);
    assert.equal(users.verifyPassword(OLD, admin.passwordHash), false);
    assert.deepEqual(state.sessions.map((s) => s.id), ['s-other']);
    assert.equal(JSON.stringify(state.users.filter((u) => u.id !== 'u-admin')), otherUsers);
});

test('a portal account with the same email is never treated as the administrator', () => {
    process.env.SEED_ADMIN_EMAIL = 'client@ncc-soc.demo';
    process.env.SEED_ADMIN_PASSWORD = NEW;
    process.env.ADMIN_PASSWORD_RESET = 'true';
    const state = baseState();
    const portalHash = state.users[0].passwordHash;
    scenarios.ensureAdministrator(state);
    assert.equal(state.users.find((u) => u.id === 'u-portal').passwordHash, portalHash);
});
