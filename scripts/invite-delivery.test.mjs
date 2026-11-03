// Invitation delivery gate (src/lib/simulation/email/invites.ts). Proves that the local invitation
// flow never reaches Brevo, and that real sending requires an explicit production-only opt-in.
// fetch is stubbed, so this test makes no network requests.
//
//   npm test
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'backend', 'src', 'simulation', 'email', 'invites.ts');
const cacheDir = join(root, 'node_modules', '.cache', 'invite-delivery-test');
const outPath = join(cacheDir, 'invites.mjs');
mkdirSync(cacheDir, { recursive: true });
const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
writeFileSync(outPath, out.outputText);

const invites = await import(pathToFileURL(outPath).href);

const ENV_KEYS = ['NODE_ENV', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_DELIVERY_ENABLED'];
const saved = {};
let fetchCalls;
const realFetch = globalThis.fetch;

beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    fetchCalls = [];
    globalThis.fetch = async (url, init) => {
        fetchCalls.push({ url: String(url), init });
        return new Response('{}', { status: 201 });
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

const send = () => invites.sendInviteEmail('invitee@example.test', 'https://app.example.test/set-password#token=x', 'analyst', 'Administrator');

test('local presentation: Brevo credentials present but delivery not enabled → no Brevo request', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BREVO_API_KEY = 'test-key-not-real';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.test';
    delete process.env.BREVO_DELIVERY_ENABLED;
    const result = await send();
    assert.equal(fetchCalls.length, 0, 'fetch must not be called');
    assert.equal(result.sent, false);
    assert.match(result.reason, /Recorded locally/);
    assert.equal(invites.isDeliveryEnabled(), false);
});

test('development mode with the opt-in flag set still never contacts Brevo', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BREVO_API_KEY = 'test-key-not-real';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.test';
    process.env.BREVO_DELIVERY_ENABLED = 'true';
    const result = await send();
    assert.equal(fetchCalls.length, 0);
    assert.equal(result.sent, false);
});

test('production opt-in without a sender address does not send', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BREVO_API_KEY = 'test-key-not-real';
    process.env.BREVO_DELIVERY_ENABLED = 'true';
    delete process.env.BREVO_SENDER_EMAIL;
    await send();
    assert.equal(fetchCalls.length, 0);
});

test('production with explicit opt-in is the only path that calls Brevo', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BREVO_API_KEY = 'test-key-not-real';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.test';
    process.env.BREVO_DELIVERY_ENABLED = 'true';
    assert.equal(invites.isDeliveryEnabled(), true);
    const result = await send();
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(result.sent, true);
});
