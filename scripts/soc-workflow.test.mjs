// SOC workflow over the shared state: policy transitions, case creation, human approvals, the
// clock control and reconciliation of counters. Uses the persisted store in a scratch directory and
// a controlled clock: no real time passes.
//
//   npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'backend', 'src', 'simulation');
const cacheDir = join(root, 'node_modules', '.cache', 'soc-workflow-test');
mkdirSync(cacheDir, { recursive: true });
const files = ['types.ts', 'store.ts', 'scenarios.ts', 'generators/assets.ts', 'generators/findings.ts', 'generators/onboarding.ts', 'generators/soc.ts', 'auth/users.ts', 'soc-policy.ts', 'soc-runtime.ts', 'soc-store.ts'];
for (const file of files) {
    const srcPath = join(srcDir, file);
    const outPath = join(cacheDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    writeFileSync(outPath, out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"));
}
const scratchCwd = join(root, 'node_modules', '.cache', 'soc-workflow-test-cwd');
mkdirSync(scratchCwd, { recursive: true });
rmSync(join(scratchCwd, 'data'), { recursive: true, force: true });
process.chdir(scratchCwd);
process.env.SIM_DATA_DIR = join(scratchCwd, 'data');

const store = await import(pathToFileURL(join(cacheDir, 'store.mjs')).href);
const runtime = await import(pathToFileURL(join(cacheDir, 'soc-runtime.mjs')).href);
const soc = await import(pathToFileURL(join(cacheDir, 'soc-store.mjs')).href);

const MIN = 60_000;
let T0;
beforeEach(() => {
    store.resetState();
    T0 = Date.parse(store.loadState().clock.nowIso) + 24 * 60 * MIN;
});

const alert = (id, minutes, severity, extra = {}) => ({
    id, title: `Test alert ${id}`, severity, category: 'Test', detection_source: 'endpoint_agent', asset_id: extra.asset_id ?? 'asset-001',
    asset_value: extra.asset_value ?? 'web-edge-01.ncc-soc.demo', identity: extra.identity ?? 'svc-test', rule_id: extra.rule ?? 'test-rule',
    mitre_ids: [], correlation_key: `${extra.rule ?? 'test-rule'}|${extra.asset_id ?? 'asset-001'}|${extra.identity ?? 'svc-test'}`,
    lifecycle: 'new', evidence_summary: 'fictional test event', related_events: [], detected_at: new Date(T0 + minutes * MIN).toISOString(),
    assigned_to: null, case_id: null, policy_history: [],
});

async function addAlerts(list) {
    await store.saveState((d) => { d.socAlerts.push(...list); });
}
async function runAt(minutesFromT0) {
    let changes = -1;
    await store.saveState((d) => { changes = runtime.runSocPolicy(d, T0 + minutesFromT0 * MIN).changes; });
    return changes;
}
const alertOf = (id) => store.loadState().socAlerts.find((a) => a.id === id);

test('low: monitored, then closed automatically after 30 minutes without related activity', async () => {
    await addAlerts([alert('t-low-1', 0, 'low', { rule: 'low-rule' })]);
    await runAt(5);
    assert.equal(alertOf('t-low-1').lifecycle, 'monitoring');
    await runAt(31);
    assert.equal(alertOf('t-low-1').lifecycle, 'auto_closed');
    const last = alertOf('t-low-1').policy_history.at(-1);
    assert.equal(last.action, 'auto_close');
    assert.match(last.reason, /30 minutes/);
});

test('medium: related activity continuous for two hours escalates to a single case', async () => {
    const times = [0, 25, 50, 75, 100, 125];
    await addAlerts(times.map((m, i) => alert(`t-med-${i}`, m, 'medium', { rule: 'med-rule' })));
    const before = store.loadState().socCases.length;
    await runAt(126);
    const cases = store.loadState().socCases;
    assert.equal(cases.length, before + 1, 'exactly one new case');
    const created = cases.at(-1);
    assert.equal(created.alert_ids.length, 6);
    assert.ok(times.every((_, i) => alertOf(`t-med-${i}`).case_id === created.id));
});

test('medium: gaps longer than 30 minutes are not continuous and do not escalate', async () => {
    const times = [0, 31, 62, 93, 124, 155];
    await addAlerts(times.map((m, i) => alert(`t-gap-${i}`, m, 'medium', { rule: 'gap-rule' })));
    const before = store.loadState().socCases.length;
    await runAt(156);
    assert.equal(store.loadState().socCases.length, before, 'no case from intermittent activity');
});

test('high: fewer than five related alerts are closed after the full 60-minute window', async () => {
    await addAlerts([alert('t-high-1', 0, 'high', { rule: 'high-few' }), alert('t-high-2', 10, 'high', { rule: 'high-few' })]);
    await runAt(59);
    assert.notEqual(alertOf('t-high-1').lifecycle, 'auto_closed', 'still observed inside the window');
    await runAt(60);
    assert.equal(alertOf('t-high-1').lifecycle, 'auto_closed');
    assert.equal(alertOf('t-high-2').lifecycle, 'auto_closed');
});

test('high: five related alerts within one hour escalate to a case', async () => {
    await addAlerts([0, 5, 10, 15, 20].map((m, i) => alert(`t-five-${i}`, m, 'high', { rule: 'five-rule' })));
    const before = store.loadState().socCases.length;
    await runAt(21);
    assert.equal(store.loadState().socCases.length, before + 1);
    assert.equal(alertOf('t-five-0').lifecycle, 'escalated');
});

test('critical: an immediate case with a human-assigned owner and a pending approval; never auto-closed', async () => {
    await addAlerts([alert('t-crit-1', 0, 'critical', { rule: 'crit-rule', asset_id: 'asset-019', asset_value: 'dc-01.internal', identity: 'svc-admin' })]);
    await runAt(0);
    const a = alertOf('t-crit-1');
    assert.ok(a.case_id, 'critical alert is attached to a case immediately');
    const c = store.loadState().socCases.find((x) => x.id === a.case_id);
    assert.ok(c.assigned_to, 'a human analyst is assigned');
    const approvals = store.loadState().socApprovals.filter((x) => x.case_id === c.id && x.status === 'pending');
    assert.equal(approvals.length, 1, 'one pending approval request');
    await runAt(10 * 24 * 60);
    assert.notEqual(alertOf('t-crit-1').lifecycle, 'auto_closed', 'a critical alert is never closed automatically');
});

test('duplicates: a repeated critical alert for the same incident attaches to the existing case', async () => {
    await addAlerts([alert('t-dup-1', 0, 'critical', { rule: 'dup-rule' })]);
    await runAt(0);
    const caseId = alertOf('t-dup-1').case_id;
    const count = store.loadState().socCases.length;
    await addAlerts([alert('t-dup-2', 3, 'critical', { rule: 'dup-rule' })]);
    await runAt(4);
    assert.equal(store.loadState().socCases.length, count, 'no second case');
    assert.equal(alertOf('t-dup-2').case_id, caseId);
});

test('idempotence: running the policy again at the same clock value changes nothing', async () => {
    await addAlerts([alert('t-idem-1', 0, 'low', { rule: 'idem-rule' })]);
    await runAt(31);
    const snapshot = JSON.stringify(store.loadState().socAlerts);
    assert.equal(await runAt(31), 0);
    assert.equal(JSON.stringify(store.loadState().socAlerts), snapshot);
});

test('seeded dataset is already consistent: the policy changes nothing at its own clock', async () => {
    const now = Date.parse(store.loadState().clock.nowIso);
    let changes = -1;
    await store.saveState((d) => { changes = runtime.runSocPolicy(d, now).changes; });
    assert.equal(changes, 0);
});

test('audit: every automated transition is recorded with action, reason and policy version', async () => {
    await addAlerts([alert('t-audit-1', 0, 'low', { rule: 'audit-rule' })]);
    await runAt(31);
    const entry = store.loadState().auditLog.filter((e) => e.action === 'soc_policy.decision' && e.details.alert_id === 't-audit-1').at(-1);
    assert.ok(entry, 'audit entry exists');
    assert.equal(entry.details.action, 'auto_close');
    assert.ok(entry.details.reason.length > 0);
    assert.equal(entry.details.policy_version, '2026-11-v1');
});

test('approvals: approval is recorded with the human actor and reflected in the case timeline', async () => {
    const pending = store.loadState().socApprovals.find((x) => x.status === 'pending');
    const approved = await soc.decideApproval(pending.id, 'approved', 'Priya Raman', null);
    assert.equal(approved.status, 'approved');
    assert.equal(approved.decided_by, 'Priya Raman');
    assert.ok(store.loadState().socCases.find((c) => c.id === pending.case_id).timeline.some((t) => /Approval approved by Priya Raman/.test(t.text)));
    await assert.rejects(() => soc.decideApproval(pending.id, 'rejected', 'Marcus Hale', 'changed mind'), (e) => e.status === 409);
});

test('approvals: rejection needs a reason, and the reason is preserved', async () => {
    const pending = store.loadState().socApprovals.find((x) => x.status === 'pending');
    await assert.rejects(() => soc.decideApproval(pending.id, 'rejected', 'Marcus Hale', '   '), (e) => e.status === 400);
    const rejected = await soc.decideApproval(pending.id, 'rejected', 'Marcus Hale', 'Owner confirmed the change');
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.decision_reason, 'Owner confirmed the change');
    assert.equal(rejected.history.at(-1).reason, 'Owner confirmed the change');
});

test('approvals: requesting more information keeps the decision open', async () => {
    const pending = store.loadState().socApprovals.find((x) => x.status === 'pending');
    await assert.rejects(() => soc.decideApproval(pending.id, 'info_requested', 'Daniel Mercer', ''), (e) => e.status === 400);
    const info = await soc.decideApproval(pending.id, 'info_requested', 'Daniel Mercer', 'Need the last 24h of login records');
    assert.equal(info.status, 'info_requested');
    const final = await soc.decideApproval(pending.id, 'approved', 'Priya Raman', null);
    assert.equal(final.status, 'approved');
});

test('clock control: advancing time moves the shared clock and runs the policy', async () => {
    await addAlerts([alert('t-clock-1', 0, 'low', { rule: 'clock-rule' })]);
    const before = Date.parse(store.loadState().clock.nowIso);
    const result = await soc.advanceSimulationTime(60, 'Administrator');
    assert.equal(Date.parse(result.now) - before, 60 * MIN);
    assert.equal(typeof result.policy_changes, 'number');
    await assert.rejects(() => soc.advanceSimulationTime(0, 'Administrator'), (e) => e.status === 400);
});

test('reconciliation: the summary counters equal the record counts they describe', () => {
    const state = store.loadState();
    const stats = soc.alertStatsShared();
    assert.equal(stats.total, state.socAlerts.length);
    assert.equal(Object.values(stats.by_severity).reduce((x, y) => x + y, 0), state.socAlerts.length);
    const summary = soc.casesSummaryShared();
    assert.equal(summary.active, state.socCases.filter((c) => c.status !== 'resolved').length);
    assert.equal(summary.critical, state.socCases.filter((c) => c.status !== 'resolved' && c.severity === 'critical').length);
    const listed = soc.listCases({});
    assert.equal(listed.total, state.socCases.length);
});

test('dataset: meets the illustrative minimums (20 alerts, 6 cases, 5 critical cases, 5 approvals)', () => {
    const state = store.loadState();
    assert.ok(state.socAlerts.length >= 20);
    assert.ok(state.socCases.length >= 6);
    assert.ok(state.socCases.filter((c) => c.severity === 'critical').length >= 5);
    assert.ok(state.socApprovals.length >= 5);
    assert.ok(state.socAlerts.every((a) => a.id && a.detected_at && a.asset_id && a.detection_source && a.severity && a.correlation_key && a.lifecycle));
    assert.ok(state.socCases.every((c) => c.id && c.alert_ids.length >= 0 && c.asset_ids.length > 0));
});

test('case detail carries linked approvals and the case timeline', () => {
    const detail = soc.getCaseDetail('case-5002');
    assert.ok(detail);
    assert.ok(detail.approvals.some((a) => a.id === 'appr-1'));
    assert.ok(detail.timeline.length > 0);
});
