// Vulnerability report, SOC insights and the deterministic remediation plan, run against the
// simulation engine. Uses a scratch data directory so the real data/ state is never touched.
//
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'backend', 'src', 'simulation');
const cacheDir = join(root, 'node_modules', '.cache', 'vms-reports-remediation-test');
mkdirSync(cacheDir, { recursive: true });

const files = ['ncc-discovery.ts', 'types.ts', 'store.ts', 'scenarios.ts', 'engine.ts', 'generators/assets.ts', 'generators/findings.ts', 'generators/onboarding.ts', 'auth/users.ts', 'reports.ts', 'insights.ts', 'remediation-plan.ts', 'generators/soc.ts', 'soc-policy.ts', 'soc-runtime.ts', 'soc-store.ts'];
for (const file of files) {
    const srcPath = join(srcDir, file);
    const outPath = join(cacheDir, file.replace(/\.ts$/, '.mjs'));
    mkdirSync(dirname(outPath), { recursive: true });
    const out = ts.transpileModule(readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: srcPath });
    writeFileSync(outPath, out.outputText.replace(/from '(\.\.?\/[^']+)'/g, "from '$1.mjs'"));
}

// Runtime contract used by ncc-discovery.ts: emitted beside the flat simulation files, and the
// top-level '../contracts/' imports are pointed at it.
{
    const cSrc = join(root, 'backend', 'src', 'contracts', 'ncc-infrastructure.ts');
    const cOut = join(cacheDir, 'contracts', 'ncc-infrastructure.mjs');
    mkdirSync(dirname(cOut), { recursive: true });
    writeFileSync(cOut, ts.transpileModule(readFileSync(cSrc, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 }, fileName: cSrc }).outputText);
    const nd = join(cacheDir, 'ncc-discovery.mjs');
    writeFileSync(nd, readFileSync(nd, 'utf8').replace("from '../contracts/", "from './contracts/"));
}

const scratchCwd = join(root, 'node_modules', '.cache', 'vms-reports-remediation-test-cwd');
mkdirSync(scratchCwd, { recursive: true });
rmSync(join(scratchCwd, 'data'), { recursive: true, force: true });
process.chdir(scratchCwd);
process.env.SIM_DATA_DIR = join(scratchCwd, 'data');

const store = await import(pathToFileURL(join(cacheDir, 'store.mjs')).href);
const { buildVulnerabilityReport } = await import(pathToFileURL(join(cacheDir, 'reports.mjs')).href);
const { buildWeeklyFacts } = await import(pathToFileURL(join(cacheDir, 'insights.mjs')).href);
const plans = await import(pathToFileURL(join(cacheDir, 'remediation-plan.mjs')).href);
const { buildDefaultState } = await import(pathToFileURL(join(cacheDir, 'scenarios.mjs')).href);

const NOW = Date.now();
const CLOSED = ['verified', 'risk_accepted', 'false_positive'];

test('report: figures match the stored findings and assets for the seeded state', () => {
    store.resetState();
    const state = store.loadState();
    const r = buildVulnerabilityReport(state, 30, NOW);
    const open = state.findings.filter((f) => !CLOSED.includes(f.status));
    assert.equal(r.open_now.total, open.length);
    assert.equal(r.summary.open_findings, open.length);
    assert.equal(r.summary.assets_assessed, state.assets.filter((a) => a.status === 'active').length);
    assert.equal(r.open_now.overdue, open.filter((f) => f.due_at && Date.parse(f.due_at) < NOW).length);
    assert.equal(r.trend.length, 30, 'one trend row per day in the period');
    assert.ok(r.top_open.every((f) => f.priority === 'P1' || f.priority === 'P2'));
});

test('report: renders with missing optional data (empty state) without throwing', () => {
    const empty = { ...buildDefaultState(), findings: [], assets: [], scans: [] };
    const r = buildVulnerabilityReport(empty, 7, NOW);
    assert.equal(r.summary.open_findings, 0);
    assert.equal(r.summary.patch_compliance_pct, null, 'no patchable findings means no compliance figure');
    assert.equal(r.summary.remediation_progress_pct, null);
    assert.deepEqual(r.top_assets, []);
    assert.equal(r.closure.available, false);
});

test('insights: facts come from the shared records', () => {
    store.resetState();
    const state = store.loadState();
    const f = buildWeeklyFacts(state, 7, NOW);
    assert.equal(f.alerts.total, state.socAlerts.length);
    assert.equal(f.cases.active, state.socCases.filter((c) => c.status !== 'resolved').length);
    assert.equal(f.vulnerabilities.open_now, state.findings.filter((x) => !CLOSED.includes(x.status)).length);
});

test('remediation plan: a valid finding yields the full plan with asset, impact, patch status and checklist', () => {
    store.resetState();
    const plan = plans.buildRemediationPlan(store.loadState(), 'find-001', NOW);
    assert.ok(plan, 'find-001 must exist in the seeded state');
    assert.equal(plan.finding.id, 'find-001');
    assert.ok(plan.asset && plan.asset.value, 'affected asset is resolved');
    assert.ok(plan.business_impact.length > 0);
    assert.equal(typeof plan.patch.available, 'boolean');
    assert.equal(plan.checklist.length, 5);
    assert.equal(plan.generated_by, 'deterministic');
    assert.equal(plan.review.status, 'pending');
});

test('remediation plan: an unknown finding ID returns null (the route answers 404 with a clear message)', () => {
    store.resetState();
    assert.equal(plans.buildRemediationPlan(store.loadState(), 'find-does-not-exist', NOW), null);
});

test('remediation decision: rejection needs a reason, a second decision is refused, approval records an audit entry', async () => {
    store.resetState();
    await assert.rejects(() => plans.decideRemediationPlan('find-002', 'rejected', 'Analyst A', '  '), (e) => e.status === 400);
    await assert.rejects(() => plans.decideRemediationPlan('find-missing', 'approved', 'Analyst A', null), (e) => e.status === 404);
    await plans.decideRemediationPlan('find-002', 'approved', 'Analyst A', null);
    const audit = store.loadState().auditLog.filter((e) => e.action === 'remediation_plan.decision' && e.details.finding_id === 'find-002');
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor, 'Analyst A');
    await assert.rejects(() => plans.decideRemediationPlan('find-002', 'rejected', 'Analyst B', 'changed mind'), (e) => e.status === 409);
    const plan = plans.buildRemediationPlan(store.loadState(), 'find-002', NOW);
    assert.equal(plan.review.status, 'approved');
    assert.equal(plan.review.decided_by, 'Analyst A');
    assert.ok(store.loadState().findings.find((f) => f.id === 'find-002').status !== undefined, 'the finding record itself is not changed by a plan decision');
});
