// Deterministic SOC triage policy (src/lib/simulation/soc-policy.ts). Uses a controlled clock: no
// real time passes, and every threshold is exercised with explicit timestamps.
//
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'backend', 'src', 'simulation', 'soc-policy.ts');
const cacheDir = join(root, 'node_modules', '.cache', 'soc-policy-test');
mkdirSync(cacheDir, { recursive: true });
const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
const outPath = join(cacheDir, 'soc-policy.mjs');
writeFileSync(outPath, out.outputText);
const policy = await import(pathToFileURL(outPath).href);

const T0 = Date.parse('2026-11-03T08:00:00Z');
const MIN = 60_000;
const ev = (minutes, severity = 'low', extra = {}) => ({ at: T0 + minutes * MIN, severity, rule: 'R1', asset_id: 'asset-001', identity: 'svc-app', ...extra });
const group = (events, extra = {}) => ({ key: 'R1|asset-001|svc-app', events, unresolved_compromise_indicator: false, existing_case_id: null, critical_case_correlated: false, ...extra });

test('low/medium: closes automatically after 30 minutes without related activity', () => {
    const g = group([ev(0, 'medium')]);
    assert.equal(policy.evaluateGroup(g, T0 + 29 * MIN).decision.action, 'monitor');
    const closed = policy.evaluateGroup(g, T0 + 30 * MIN);
    assert.equal(closed.decision.action, 'auto_close');
    assert.equal(closed.policy_version, policy.POLICY_VERSION);
});

test('low/medium: intermittent events with gaps over 30 minutes are not continuous activity', () => {
    const times = [0, 31, 62, 93, 124];
    const g = group(times.map((m) => ev(m, 'low')));
    assert.equal(policy.longestContinuousMs(times.map((m) => T0 + m * MIN)), 0, 'every gap is 31 minutes, so no run lasts');
    assert.notEqual(policy.evaluateGroup(g, T0 + 124 * MIN + 5 * MIN).decision.action, 'escalate_case');
});

test('low/medium: continuous activity for 2 hours escalates to a case', () => {
    const times = Array.from({ length: 25 }, (_, i) => i * 5);
    const g = group(times.map((m) => ev(m, 'low')));
    const d = policy.evaluateGroup(g, T0 + 125 * MIN);
    assert.equal(d.decision.action, 'escalate_case');
    assert.equal(d.evidence.longest_continuous_ms, 120 * MIN);
});

test('high: below five related alerts, the group stays under observation until the 60-minute window ends', () => {
    const g = group([ev(0, 'high'), ev(10, 'high'), ev(20, 'high')]);
    assert.equal(policy.evaluateGroup(g, T0 + 59 * MIN).decision.action, 'monitor');
});

test('high: below five alerts and no indicators, closes after the full 60-minute window', () => {
    const g = group([ev(0, 'high'), ev(10, 'high'), ev(20, 'high')]);
    assert.equal(policy.evaluateGroup(g, T0 + 60 * MIN).decision.action, 'auto_close');
});

test('high: an unresolved compromise indicator blocks automatic closure at the window end', () => {
    const g = group([ev(0, 'high')], { unresolved_compromise_indicator: true });
    assert.equal(policy.evaluateGroup(g, T0 + 61 * MIN).decision.action, 'escalate_case');
});

test('high: five related alerts within one hour escalate to a case', () => {
    const g = group([0, 5, 10, 15, 20].map((m) => ev(m, 'high')));
    const d = policy.evaluateGroup(g, T0 + 21 * MIN);
    assert.equal(d.decision.action, 'escalate_case');
    assert.match(d.decision.reason, /5 related high alerts/);
});

test('critical: creates a case immediately and never closes automatically', () => {
    const g = group([ev(0, 'critical')]);
    assert.equal(policy.evaluateGroup(g, T0).decision.action, 'create_case');
    const later = policy.evaluateGroup(g, T0 + 10_000 * MIN);
    assert.notEqual(later.decision.action, 'auto_close', 'a critical alert must never close automatically');
    assert.match(later.decision.reason, /assigned to an analyst/);
});

test('duplicates: a repeated critical alert for the same incident attaches to the existing case', () => {
    const g = group([ev(0, 'critical'), ev(3, 'critical')], { existing_case_id: 'case-9001' });
    const d = policy.evaluateGroup(g, T0 + 4 * MIN);
    assert.deepEqual(d.decision, { action: 'attach_case', case_id: 'case-9001', reason: d.decision.reason });
});

test('audit: every decision carries an audit entry with the action, reason and policy version', () => {
    const d = policy.evaluateGroup(group([ev(0, 'medium')]), T0 + 30 * MIN);
    assert.equal(d.audit.action, 'soc_policy.decision');
    assert.equal(d.audit.details.action, 'auto_close');
    assert.equal(d.audit.details.policy_version, policy.POLICY_VERSION);
    assert.ok(d.audit.details.reason.length > 0);
    assert.equal(d.audit.at, T0 + 30 * MIN);
});

test('determinism: the same inputs and clock always produce the same decision', () => {
    const g = group([ev(0, 'low'), ev(5, 'low')]);
    assert.deepEqual(policy.evaluateGroup(g, T0 + 60 * MIN), policy.evaluateGroup(g, T0 + 60 * MIN));
});
