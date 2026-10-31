// NovaSOC NCC — single interception point for every API call the retained UI makes.
// apiFetch() (src/lib/api.ts) routes every request through demoRespond() instead of a real
// network call, so no page or hook needed to change. Unmatched paths get an honest empty-but-
// valid response, never a fake success payload shaped like a crash or a silent 200 with lies.

import { DEMO_ASSETS, DEMO_ASSETS_TOTAL, byAssetId, DEMO_SERVICES_BY_ASSET, DEMO_TECH_BY_ASSET, DEMO_EVENTS_BY_ASSET, DEMO_EVENTS } from './assets';
import { DEMO_FINDINGS, DEMO_SCANS, DEMO_VMS_OVERVIEW, findingsByStatusGroup, findingDetail, getFindingsSummary, getRisk, getRiskScore, getRemediationItems, getTasks, patchFinding, patchTaskByTaskId, addExtraTask } from './vulnerabilities';
import { DEMO_ALERTS, DEMO_ALERT_STATS, byAlertId, patchAlert } from './alerts';
import { DEMO_CASES, DEMO_CASES_SUMMARY, DEMO_PLAYBOOKS, DEMO_APPROVALS } from './incidents';
import { DEMO_TI_FEEDS, DEMO_TI_OVERVIEW, DEMO_TI_ACTORS, DEMO_TI_MATCHES, DEMO_TI_MAP_POINTS, DEMO_TI_VULNERABILITIES } from './threats';
import { DEMO_WEEKLY_INSIGHTS, DEMO_REPORTS } from './reports';
import { DEMO_COLLECTORS, DEMO_WORKER_STATUS, DEMO_DEPLOYMENT_STEPS } from './collectors';
import { getNigeriaThreatsResponse } from './nigeria';
import { checkDemoCredentials, mintAdminToken, mintPortalToken, DEMO_PORTAL_USER } from './auth';

export interface DemoResponse {
    status: number;
    data: unknown;
}

// Session-lived store for orgs created through the onboarding wizard — demo-only, resets on reload.
const DEMO_ORGANISATIONS: { id: string; name: string; domain: string; industry: string; plan: string; wazuh_group?: string }[] = [];

function parseBody(body: unknown): Record<string, unknown> {
    if (!body) return {};
    if (typeof body === 'string') { try { return JSON.parse(body); } catch { return {}; } }
    return body as Record<string, unknown>;
}

/** path = pathname only (no origin); query = URLSearchParams already parsed from the same URL. */
export function demoRespond(method: string, path: string, query: URLSearchParams, rawBody: unknown): DemoResponse {
    const body = parseBody(rawBody);

    // --- Auth (admin) ---
    if (path === '/api/auth/signin' && method === 'POST') {
        const email = String(body.email ?? '');
        const password = String(body.password ?? '');
        if (checkDemoCredentials(email, password)) return { status: 200, data: { token: mintAdminToken() } };
        return { status: 401, data: { error: 'Invalid credentials' } };
    }
    if (path === '/api/auth/google' && method === 'POST') {
        // Demo build never calls real Google OAuth; honest failure so the button doesn't lie.
        return { status: 501, data: { error: 'Google sign-in is not available in this demonstration build. Use the demo email/password shown on the login page.' } };
    }
    if (path === '/api/auth/heartbeat') return { status: 200, data: { ok: true } };

    // --- Auth (portal) ---
    if (path === '/api/portal/status') return { status: 200, data: { configured: true } };
    if (path === '/api/portal/auth/signin' && method === 'POST') {
        const email = String(body.email ?? '');
        const password = String(body.password ?? '');
        if (checkDemoCredentials(email, password)) return { status: 200, data: { token: mintPortalToken(), user: DEMO_PORTAL_USER } };
        return { status: 401, data: { error: 'Invalid credentials. Contact your security team.' } };
    }

    // --- VMS ---
    if (path === '/api/vms/overview') return { status: 200, data: DEMO_VMS_OVERVIEW };
    if (path === '/api/client/vms/summary') {
        return { status: 200, data: { total_assets: DEMO_ASSETS_TOTAL, open_findings: getFindingsSummary().open, risk_score: getRiskScore(), by_severity: getFindingsSummary().by_severity } };
    }
    if (path === '/api/vms/assets' || path === '/api/client/vms/assets') {
        return { status: 200, data: { assets: DEMO_ASSETS, total: DEMO_ASSETS_TOTAL } };
    }
    {
        const m = path.match(/^\/api\/vms\/assets\/([^/]+)\/graph$/);
        if (m) {
            const a = byAssetId(m[1]);
            return a ? { status: 200, data: { nodes: [{ id: a.id, value: a.value, asset_type: a.asset_type }], edges: [] } } : { status: 404, data: { error: 'Asset not found' } };
        }
    }
    {
        const m = path.match(/^\/api\/vms\/assets\/([^/]+)$/);
        if (m && method === 'PATCH') {
            const a = byAssetId(m[1]);
            if (!a) return { status: 404, data: { error: 'Asset not found' } };
            // Real local mutation (session-lived, resets on page reload) — not a fabricated success.
            if (typeof body.owner === 'string') a.owner = body.owner;
            if (body.criticality === 'critical' || body.criticality === 'high' || body.criticality === 'medium' || body.criticality === 'low') a.criticality = body.criticality;
            return { status: 200, data: { asset: a, message: 'Demo workflow — change applied to this session only, not persisted to a real inventory.' } };
        }
        if (m) {
            const a = byAssetId(m[1]);
            if (!a) return { status: 404, data: { error: 'Asset not found' } };
            return { status: 200, data: { asset: a, services: DEMO_SERVICES_BY_ASSET[a.id] ?? [], technologies: DEMO_TECH_BY_ASSET[a.id] ?? [], events: DEMO_EVENTS_BY_ASSET[a.id] ?? [] } };
        }
    }
    if (path === '/api/vms/findings/summary') return { status: 200, data: getFindingsSummary() };
    {
        const m = path.match(/^\/api\/vms\/findings\/([^/]+)\/tasks$/);
        if (m && method === 'POST') {
            const task = addExtraTask(m[1], { title: String(body.title ?? 'Remediation task'), details: body.details ? String(body.details) : undefined, owner: body.owner ? String(body.owner) : undefined, due_at: body.due_at ? String(body.due_at) : undefined, ai_artifact_id: body.ai_artifact_id as string | null | undefined });
            return { status: 200, data: { task, message: 'Demo workflow — task added to this session only.' } };
        }
    }
    {
        const m = path.match(/^\/api\/vms\/findings\/([^/]+)$/);
        if (m && method === 'PATCH') {
            const updated = patchFinding(m[1], { status: body.status as never, owner: body.owner === undefined ? undefined : (body.owner as string | null), due_at: body.due_at === undefined ? undefined : (body.due_at as string | null) });
            return updated ? { status: 200, data: { finding: updated, message: 'Demo workflow — status change applied to this session only, not sent to a real scanner or ticketing system.' } } : { status: 404, data: { error: 'Finding not found' } };
        }
        if (m) {
            const detail = findingDetail(m[1]);
            return detail ? { status: 200, data: detail } : { status: 404, data: { error: 'Finding not found' } };
        }
    }
    {
        const m = path.match(/^\/api\/vms\/tasks\/([^/]+)$/);
        if (m && method === 'PATCH') {
            const updated = patchTaskByTaskId(m[1], { status: body.status as never, owner: body.owner === undefined ? undefined : (body.owner as string | null), due_at: body.due_at === undefined ? undefined : (body.due_at as string | null) });
            return updated ? { status: 200, data: { message: 'Demo workflow — task status applied to this session only.' } } : { status: 404, data: { error: 'Task not found' } };
        }
    }
    if (path === '/api/vms/findings') {
        const assetId = query.get('asset_id');
        let list = findingsByStatusGroup(query.get('status'));
        if (assetId) list = list.filter((f) => f.asset_id === assetId);
        return { status: 200, data: { findings: list, total: list.length } };
    }
    if (path.startsWith('/api/vms/scans')) return { status: 200, data: { scans: DEMO_SCANS, total: DEMO_SCANS.length } };
    if (path === '/api/vms/risk') return { status: 200, data: getRisk() };
    if (path === '/api/vms/remediation') return { status: 200, data: { items: getRemediationItems() } };
    if (path === '/api/vms/services') return { status: 200, data: { services: [{ id: 'svc-1', name: 'Vulnerability scanning', status: 'active' }, { id: 'svc-2', name: 'Continuous discovery', status: 'active' }] } };
    if (path === '/api/vms/scopes') return { status: 200, data: { scopes: [{ id: 'scope-1', name: 'Production network', cidrs: ['10.20.0.0/16'], approved: true }] } };
    if (path === '/api/vms/profiles') return { status: 200, data: { profiles: [{ id: 'profile-1', name: 'Standard weekly scan', kinds: ['discovery', 'ports', 'vuln_nuclei'] }] } };
    if (path === '/api/vms/operations') {
        // VmsMonitorOps.tsx reads ops.data?.queue.queued (only the first hop is optional-chained),
        // so a response missing `queue` throws exactly like the Nigeria map bug did. Shaped to
        // match the real VmsOperations interface (src/lib/vms.ts) in full, not just the two fields
        // the old fixture had.
        return {
            status: 200,
            data: {
                engines: [
                    { id: 'discovery', label: 'Discovery', kind: 'discovery', state: 'available', note: '', versions: ['1.8.2'] },
                    { id: 'ports', label: 'Ports & services', kind: 'ports', state: 'available', note: '', versions: ['1.8.2'] },
                    { id: 'vuln_nuclei', label: 'Nuclei', kind: 'vuln_nuclei', state: 'available', note: '', versions: ['1.8.2'] },
                    { id: 'vuln_openvas', label: 'OpenVAS', kind: 'vuln_openvas', state: 'not_enabled', note: 'Disabled in this demonstration build', versions: [] },
                ],
                worker_presence: { state: 'online', source: 'demo', online_workers: DEMO_WORKER_STATUS.workers.length, last_seen_at: DEMO_WORKER_STATUS.workers[0]?.last_seen ?? null },
                queue: { queued: 0, running: 1, oldest_queued_at: null },
                last_7_days: {},
                active: [],
                recent_failures: [],
                wazuh_sync: { last_attempt_at: new Date(Date.now() - 3_600_000).toISOString(), last_complete_at: new Date(Date.now() - 3_600_000).toISOString(), complete: true, problem: null },
            },
        };
    }
    if (path === '/api/vms/events') return { status: 200, data: { events: DEMO_EVENTS } };
    if (path === '/api/vms/ai-plans') return { status: 200, data: { plans: [] } };
    if (path === '/api/vms/tasks' || path === '/api/client/vms/tasks') return { status: 200, data: { tasks: getTasks() } };
    if (path === '/api/vms/assessments') return { status: 200, data: { assessments: [] } };
    if (path === '/api/vms/admin/status') {
        // VmsMonitorOps.tsx reads s?.scopes.active and s?.policies.available (first hop only
        // optional-chained) — the old fixture (`{workers:[...]}`) had neither `scopes` nor
        // `policies` at all, so both threw. Shaped to match the real AdminStatus interface in full.
        return {
            status: 200,
            data: {
                deployed_version: '1.8.2',
                workers: { source: 'demo', online: DEMO_WORKER_STATUS.workers.filter((w) => w.status === 'online').length, window_seconds: 300, list: DEMO_WORKER_STATUS.workers.map((w) => ({ worker_id: w.id, online: w.status === 'online', version: '1.8.2', kinds: w.kind.split(','), tools: { nmap: true, nuclei: true, subfinder: true }, tool_versions: {}, networks: [], features: [], last_seen_at: w.last_seen, last_heartbeat_at: w.last_seen, last_claim_at: null, last_job_at: null })) },
                scheduler: { last_run_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), policies: { at: new Date(Date.now() - 24 * 3_600_000).toISOString() } },
                wazuh: { available: true, freshness: { last_attempt_at: new Date(Date.now() - 3_600_000).toISOString(), last_complete_at: new Date(Date.now() - 3_600_000).toISOString(), complete: true, problem: null } },
                cve_intel: { tracked: DEMO_FINDINGS.length, kev_checked_at: new Date(Date.now() - 6 * 3_600_000).toISOString(), epss_fetched_at: new Date(Date.now() - 6 * 3_600_000).toISOString(), nvd_fetched_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), osv: { available: true, fetched_at: new Date(Date.now() - 6 * 3_600_000).toISOString() } },
                ai: { configured: false, model: 'none (demonstration build)' },
                evidence: { available: true, retention_days: 30, items: 0, next_expiry: null },
                scopes: { active: 1, expired_or_revoked: 0, with_exclusions: 0, passive_only: 0, vuln_allowed: 1 },
                policies: { available: true, note: 'Demonstration policy — not editable in this preview build.', list: [] },
            },
        };
    }
    if (path === '/api/vms/audit') return { status: 200, data: { entries: [] } };
    if (path === '/api/vms/endpoints') return { status: 200, data: { endpoints: DEMO_ASSETS.filter((a) => a.asset_type === 'endpoint') } };
    if (path === '/api/vms/schedules') return { status: 200, data: { schedules: [{ id: 'sched-1', name: 'Weekly discovery + Nuclei', kinds: ['discovery', 'vuln_nuclei'], cron: '0 2 * * 1', enabled: true }] } };
    if (path === '/api/vms/report') return { status: 200, data: { summary: getFindingsSummary(), assets_total: DEMO_ASSETS_TOTAL, generated_at: new Date().toISOString() } };
    if (path === '/api/vms/admin/policies') return { status: 200, data: { policies: [{ id: 'policy-1', name: 'Standard scan policy', kinds: ['discovery', 'ports', 'vuln_nuclei'] }] } };
    if (path === '/api/vms/admin/wazuh/check') return { status: 200, data: { ok: true, agents_reporting: DEMO_ASSETS.filter((a) => a.wazuh_agent_id).length } };
    if (path === '/api/vms/eligibility/refresh' && method === 'POST') return { status: 200, data: { message: 'Demo workflow — eligibility re-check is simulated, no real Wazuh call was made.', refreshed: DEMO_ASSETS.filter((a) => a.wazuh_agent_id).length } };

    // --- Threat Intelligence ---
    if (path === '/api/ti/sources') {
        // TiSources.tsx reads d?.misp.last_check (first hop only optional-chained) — the old
        // fixture (`{feeds:[...]}` alone) had no `misp`/`enrichment`/`ai`/`sharing`/`exchange`
        // keys at all, so it threw. Shaped to match the real `TiSources` interface (src/lib/ti.ts).
        return {
            status: 200,
            data: {
                feeds: DEMO_TI_FEEDS,
                runs: [],
                enrichment: { nvd: { last_fetch: new Date(Date.now() - 2 * 3_600_000).toISOString(), configured_key: true, cves_tracked: DEMO_FINDINGS.length }, epss: { last_fetch: new Date(Date.now() - 6 * 3_600_000).toISOString() } },
                misp: { configured: true, writes_enabled: false, last_check: null },
                ai: { provider: 'nvidia', configured: false, model: 'none (demonstration build)', reachable: false, detail: 'AI is not connected in this preview build.' },
                sharing: { source_records_by_tlp: { clear: 2, green: 1, amber: 0, 'amber+strict': 0, red: 0 } },
                exchange: { taxii_discovery: '', api_root: '', collections: [], active_clients: 0 },
            },
        };
    }
    if (path === '/api/ti/overview') {
        // TiOverview.tsx reads ov.data?.indicators.active and ov.data?.matches.new (first hop
        // only optional-chained) — DEMO_TI_OVERVIEW's flat shape (`total_indicators`, no
        // `indicators`/`matches` keys at all) threw on both. Nested to match the real `Overview`
        // interface, deriving matches from DEMO_TI_MATCHES rather than inventing a second number.
        return {
            status: 200,
            data: {
                indicators: { active: DEMO_TI_OVERVIEW.total_indicators, new_last_24h: DEMO_TI_OVERVIEW.new_last_24h, by_type: { ip: 1, domain: 0, hash: 0, url: 1 } },
                matches: { new: DEMO_TI_MATCHES.filter((m) => m.status === 'new').length, total: DEMO_TI_MATCHES.length },
                feeds: DEMO_TI_FEEDS,
            },
        };
    }
    if (path === '/api/ti/actors') return { status: 200, data: { actors: DEMO_TI_ACTORS } };
    if (path === '/api/ti/matches') return { status: 200, data: { matches: DEMO_TI_MATCHES } };
    if (path === '/api/ti/map') return { status: 200, data: { points: DEMO_TI_MAP_POINTS } };
    if (path === '/api/ti/vulnerabilities') return { status: 200, data: { vulnerabilities: DEMO_TI_VULNERABILITIES, total: DEMO_TI_VULNERABILITIES.length } };
    if (path.startsWith('/api/ti/reports')) return { status: 200, data: { reports: DEMO_REPORTS } };
    if (path.startsWith('/api/ti/exchange/clients')) return { status: 200, data: { clients: [] } };
    if (path.startsWith('/api/ti/sources/misp/check')) return { status: 200, data: { misp: { ok: false, message: 'MISP is not connected in this demonstration build.' } } };
    if (/^\/api\/ti\/feeds\/[^/]+\/run$/.test(path) && method === 'POST') return { status: 200, data: { status: 'ok', counts: { new: 0 } } };

    // --- SecOps / Cases / Alerts ---
    if (path === '/api/cases' || path === '/api/incidents') return { status: 200, data: { cases: DEMO_CASES, total: DEMO_CASES.length, summary: DEMO_CASES_SUMMARY } };
    {
        // CaseWorkbench.tsx reads `data.case.id` — a bare case object here (no `.case` wrapper)
        // threw a TypeError on open, crashing the detail view rather than just showing it empty.
        const m = path.match(/^\/api\/(?:cases|incidents)\/([^/]+)$/);
        if (m) {
            const found = DEMO_CASES.find((c) => c.id === m[1]);
            if (!found) return { status: 404, data: { error: 'Case not found in demo dataset' } };
            if (method === 'PATCH') {
                if (typeof body.status === 'string') found.status = body.status as typeof found.status;
                if (typeof body.assigned_to === 'string' || body.assigned_to === null) found.assigned_to = body.assigned_to as string | null;
                found.updated_at = new Date().toISOString();
            }
            return { status: 200, data: { case: found, notes: [], tasks: [], timeline: found.timeline, iocs: [] } };
        }
        const action = path.match(/^\/api\/cases\/([^/]+)\/(execute-step|escalate|report)$/);
        if (action && (method === 'POST' || method === 'GET')) {
            const found = DEMO_CASES.find((c) => c.id === action[1]);
            if (!found) return { status: 404, data: { error: 'Case not found in demo dataset' } };
            if (action[2] === 'report') return { status: 200, data: { report_url: null, message: 'Demo workflow — report generation is simulated; no file is produced in this preview build.' } };
            found.timeline.push({ at: new Date().toISOString(), text: action[2] === 'escalate' ? 'Escalated (demo workflow — no real notification sent).' : 'Playbook step marked complete (demo workflow — no real response action executed).' });
            found.updated_at = new Date().toISOString();
            return { status: 200, data: { message: action[2] === 'escalate' ? 'Case escalated in this demo session.' : 'Step recorded in this demo session.', case: found } };
        }
    }
    if (path === '/api/communications/recipients') return { status: 200, data: { recipients: [{ name: 'SOC Mailbox (demo)', email: 'soc@novasoc-ncc.local' }] } };
    {
        const m = path.match(/^\/api\/playbooks\/([^/]+)\/run$/);
        if (m && method === 'POST') return { status: 200, data: { message: 'Demo workflow — playbook run is simulated; no real response action was executed.', run_id: `run-demo-${Date.now()}` } };
    }
    if (path === '/api/playbooks') return { status: 200, data: { playbooks: DEMO_PLAYBOOKS } };
    if (path.startsWith('/api/approvals') || path.startsWith('/api/soar/response-requests')) return { status: 200, data: { approvals: DEMO_APPROVALS } };
    if (path === '/api/alerts/stats') return { status: 200, data: DEMO_ALERT_STATS };
    {
        // Specific /api/alerts/:id... routes MUST be checked before the plain-list catch-all below —
        // that catch-all previously matched every one of these too (startsWith) and returned the
        // whole alert LIST in place of a single alert or an action result.
        const events = path.match(/^\/api\/alerts\/([^/]+)\/events$/);
        if (events) return { status: 200, data: { events: [] } };
        const statusAction = path.match(/^\/api\/alerts\/([^/]+)\/status$/);
        if (statusAction && (method === 'POST' || method === 'PATCH')) {
            const updated = patchAlert(statusAction[1], { status: body.status as never });
            return updated ? { status: 200, data: { alert: updated, message: 'Demo workflow — status change applied to this session only, not sent to Wazuh.' } } : { status: 404, data: { error: 'Alert not found' } };
        }
        const caseAction = path.match(/^\/api\/alerts\/([^/]+)\/case$/);
        if (caseAction && method === 'POST') {
            const a = byAlertId(caseAction[1]);
            if (!a) return { status: 404, data: { error: 'Alert not found' } };
            if (a.case_id) return { status: 200, data: { case_id: a.case_id, message: 'This alert already has a case.' } };
            const newCase = { id: `case-demo-${Date.now()}`, title: a.rule_description ?? 'New case', severity: a.severity, status: 'open' as const, tier: 1 as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), assigned_to: null, agent_name: a.agent_name ?? 'unknown', mitre: (a.mitre_ids ?? []).map((id) => ({ id, tactic: 'Unknown' })), timeline: [{ at: new Date().toISOString(), text: `Case created manually from alert ${a.id} (demo workflow).` }] };
            DEMO_CASES.push(newCase);
            patchAlert(a.id, { case_id: newCase.id });
            return { status: 200, data: { case_id: newCase.id, message: 'Case created in this demo session.' } };
        }
        const one = path.match(/^\/api\/alerts\/([^/]+)$/);
        if (one) {
            const a = byAlertId(one[1]);
            return a ? { status: 200, data: { alert: a } } : { status: 404, data: { error: 'Alert not found' } };
        }
    }
    if (path.startsWith('/api/alerts')) return { status: 200, data: { alerts: DEMO_ALERTS, total: DEMO_ALERTS.length } };
    // Field names match what GeneralDashboard.tsx actually reads (agent_count/active_agents/
    // disconnected_agents) — a prior mismatch here (agents_registered/agents_active) made the
    // dashboard's Agents KPI silently show "—" instead of demo data.
    if (path.startsWith('/api/wazuh/status')) return { status: 200, data: { connected: true, agent_count: 5, active_agents: 4, disconnected_agents: 1 } };
    if (path.startsWith('/api/wazuh/agents')) return { status: 200, data: { total: 5, active: 4 } }; // consistent with /api/wazuh/status above
    if (path.startsWith('/api/wazuh/alerts-indexer')) {
        // Derived from DEMO_ALERTS so the Executive Report's "Critical Alerts" figure can't drift
        // from the Alerts/SecOps pages showing the same underlying data.
        return { status: 200, data: { criticalCount: DEMO_ALERTS.filter((a) => a.severity === 'critical').length } };
    }
    if (path.startsWith('/api/wazuh/mitre-stats')) {
        // Derived from DEMO_ALERTS' own mitre_ids, grouped by the ATT&CK tactic each technique
        // belongs to, so this can't drift from the alerts feed shown elsewhere on the dashboard.
        return {
            status: 200,
            data: {
                source: 'demo',
                tactics: {
                    'Initial Access': 1, // T1190 (alert-9002)
                    Execution: 1, // T1059 (alert-9002)
                    Persistence: 0,
                    'Privilege Escalation': 1, // T1548 (alert-9004)
                    'Credential Access': 1, // T1110 (alert-9001)
                    'Lateral Movement': 0,
                    Exfiltration: 1, // T1041 (alert-9005)
                    'Command and Control': 1, // T1071 (alert-9005)
                },
            },
        };
    }
    if (path.startsWith('/api/org-cti/stats')) {
        // Consistent with DEMO_TI_MATCHES (threats.ts) rather than a separate invented number.
        return { status: 200, data: { malicious: 3, suspicious: 2, total_iocs: DEMO_TI_MATCHES.length } };
    }
    if (path.startsWith('/api/wazuh/trend')) {
        // Shaped like the real /api/wazuh/trend response GeneralDashboard.tsx expects: an array
        // of { label, alerts, incidents, critical }, newest last. Alert/critical counts here are
        // illustrative trend shape, not a recount of DEMO_ALERTS (which covers a single ~5h
        // window) — kept internally consistent across points rather than random per the brief.
        const range = query.get('range') ?? '7d';
        const points = range === '24h'
            ? [['00:00', 3, 1, 0], ['04:00', 2, 0, 0], ['08:00', 5, 2, 1], ['12:00', 7, 3, 1], ['16:00', 6, 2, 1], ['20:00', 4, 1, 0]]
            : range === '30d'
                ? [['Wk 1', 38, 14, 3], ['Wk 2', 44, 17, 4], ['Wk 3', 31, 11, 2], ['Wk 4', 29, 9, 2]]
                : [['Mon', 9, 3, 1], ['Tue', 6, 2, 0], ['Wed', 11, 4, 1], ['Thu', 8, 3, 1], ['Fri', 13, 5, 2], ['Sat', 4, 1, 0], ['Sun', 5, 2, 1]];
        return { status: 200, data: points.map(([label, alerts, incidents, critical]) => ({ label, alerts, incidents, critical })) };
    }
    if (path.startsWith('/api/dashboard/nigeria-threats')) {
        // GeneralDashboard -> NigeriaThreatMap. This had NO entry before, so GET fell through to
        // the generic `{status:200, data:{}}` below: `data` was truthy but `data.summary` was
        // undefined, and the component's `data?.summary.error` (optional-chained on `data`, not
        // on `summary`) threw "Cannot read properties of undefined (reading 'error')" on every
        // load. Returning the real response shape fixes it at the source; the component's own
        // `summary?.x` guards elsewhere were already correct.
        return { status: 200, data: getNigeriaThreatsResponse() };
    }
    if (path.startsWith('/api/platform/health')) {
        // "operational" with every monitored service up — consistent with /api/wazuh/status
        // above reporting the manager as connected in this demo build.
        const services = [
            { name: 'Wazuh Manager', status: 'up', latency_ms: 42 },
            { name: 'Alert Store', status: 'up', latency_ms: 18 },
            { name: 'VMS Scanner Worker', status: 'up', latency_ms: 65 },
            { name: 'SOAR Engine', status: 'up', latency_ms: 31 },
        ];
        return { status: 200, data: { overall: 'operational', services } };
    }

    // --- Reporting / Insights ---
    if (path.startsWith('/api/insights')) return { status: 200, data: DEMO_WEEKLY_INSIGHTS };

    // --- Security Assessment report card (client portal + staff preview) --- figures derived
    // from DEMO_CASES/DEMO_CASES_SUMMARY so this can't show a different case count than Cases/SecOps.
    {
        const closed = DEMO_CASES.filter((c) => c.status === 'closed');
        const monthly = [
            { month: 'Aug', sla_rate: 88, resolved: 3 },
            { month: 'Sep', sla_rate: 90, resolved: 4 },
            { month: 'Oct', sla_rate: 92, resolved: closed.length },
        ];
        const definitions = { sla_target_hours: { critical: 4, high: 8, medium: 24, low: 72 }, sla_secure_threshold_pct: 85, detection_time: 'Not tracked yet — requires a connected detection pipeline.' };
        const posture = DEMO_CASES_SUMMARY.critical > 0 ? 'at_risk' : 'secure';
        if (path === '/api/client/security-assessment') {
            return {
                status: 200,
                data: {
                    org_id: 'org-demo-1', org_name: 'NovaSOC NCC Demo Org', detection_time_hrs: null,
                    response_time_hrs: 1.4, response_sample: DEMO_CASES.length, close_time_hrs: closed.length ? 6.2 : null,
                    open_cases: DEMO_CASES_SUMMARY.active, closed_this_month: closed.length, resolved_30d: closed.length,
                    sla_rate: closed.length ? 92 : null, posture, trend: 'stable', monthly,
                    last_closed: closed.map((c) => ({ id: c.id, case_number: c.id, title: c.title, severity: c.severity, close_time_hrs: 6.2, within_sla: true, resolved_at: c.updated_at })),
                    engagement: { score: 72, components: [
                        { key: 'response', label: 'Response time', max: 40, value: 32, reason: 'Average response time across recent cases' },
                        { key: 'closure', label: 'Case closure', max: 30, value: 24, reason: 'Cases closed within SLA' },
                        { key: 'playbooks', label: 'Playbook usage', max: 30, value: 16, reason: 'Share of cases run through a playbook' },
                    ] },
                    orgs: [{ slug: 'demo-org', name: 'NovaSOC NCC Demo Org' }], definitions,
                },
            };
        }
        if (path === '/api/admin/security-assessment/overview') {
            return {
                status: 200,
                data: {
                    summary: { active_clients: 1, avg_detection_time_hrs: null, avg_close_time_hrs: closed.length ? 6.2 : null, open_cases: DEMO_CASES_SUMMARY.active, sla_rate: closed.length ? 92 : null, clients_below_sla: 0 },
                    clients: [{ org_id: 'org-demo-1', org_name: 'NovaSOC NCC Demo Org', detection_time_hrs: null, close_time_hrs: closed.length ? 6.2 : null, open_cases: DEMO_CASES_SUMMARY.active, closed_this_month: closed.length, resolved_30d: closed.length, sla_rate: closed.length ? 92 : null, posture, trend: 'stable', last_updated: new Date().toISOString() }],
                    monthly, definitions, generated_at: new Date().toISOString(),
                },
            };
        }
    }

    // --- Onboarding / Collectors ---
    if (path.startsWith('/api/admin/collectors') || path.startsWith('/api/collectors')) return { status: 200, data: { collectors: DEMO_COLLECTORS } };
    if (path.startsWith('/api/onboarding/deployment-steps')) return { status: 200, data: { steps: DEMO_DEPLOYMENT_STEPS } };

    // --- Onboarding / New-client wizard (OnboardingWizard.tsx) --- a real local mutation
    // (session-lived demo orgs list), not a scripted success — so the wizard's own completion
    // screen, which reads org.id/org.name back, reflects what was actually submitted.
    if (path === '/api/organisations' && method === 'POST') {
        const id = `org-demo-${Date.now()}`;
        const org = { id, name: String(body.name ?? 'New organisation'), domain: String(body.domain ?? ''), industry: String(body.industry ?? ''), plan: String(body.plan ?? 'starter') };
        DEMO_ORGANISATIONS.push(org);
        return { status: 201, data: org };
    }
    {
        const m = path.match(/^\/api\/organisations\/([^/]+)\/setup$/);
        if (m && method === 'POST') return { status: 200, data: { ok: true, message: 'Demo workflow — compliance baseline recorded for this session only.' } };
    }
    {
        const m = path.match(/^\/api\/organisations\/([^/]+)\/users$/);
        if (m && method === 'POST') return { status: 200, data: { ok: true, message: 'Demo workflow — team member added to this session only, no invitation email was sent.' } };
    }
    {
        const m = path.match(/^\/api\/organisations\/([^/]+)$/);
        if (m && method === 'PATCH') {
            const org = DEMO_ORGANISATIONS.find((o) => o.id === m[1]);
            if (org && typeof body.wazuh_group === 'string') (org as { wazuh_group?: string }).wazuh_group = body.wazuh_group;
            return { status: 200, data: { ok: true } };
        }
        if (m) {
            const org = DEMO_ORGANISATIONS.find((o) => o.id === m[1]);
            return org ? { status: 200, data: org } : { status: 404, data: { error: 'Organisation not found' } };
        }
    }
    if (path === '/api/organisations') return { status: 200, data: { organisations: DEMO_ORGANISATIONS } };

    // --- Settings (trivial demo-only answers) ---
    if (path === '/api/admin/team/presence') {
        return {
            status: 200,
            data: {
                members: [
                    { email: 'demo@novasoc-ncc.local', name: 'Demo Administrator', role: 'super_admin', account_status: 'active', status: 'online', last_active: new Date().toISOString(), active_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], cases_assigned: DEMO_CASES.filter((c) => c.assigned_to === 'Demo Administrator').length, avg_response_hrs: 1.4, response_sample: DEMO_CASES.length },
                    { email: 'analyst@novasoc-ncc.local', name: 'Demo SOC Analyst', role: 'analyst', account_status: 'active', status: 'away', last_active: new Date(Date.now() - 20 * 60_000).toISOString(), active_days: ['Mon', 'Tue', 'Wed'], cases_assigned: 2, avg_response_hrs: 2.1, response_sample: 4 },
                ],
                history: 'since_restart', generated_at: new Date().toISOString(),
            },
        };
    }
    if (path.startsWith('/api/admin/team') || path.startsWith('/api/admin/users')) return { status: 200, data: { users: [{ id: 'u1', name: 'Demo Administrator', role: 'super_admin', email: 'demo@novasoc-ncc.local' }] } };
    if (path.startsWith('/api/settings')) return { status: 200, data: {} };

    // --- Fallback: honest empty-but-valid for reads, honest FAILURE for writes — a 200 here would
    // make every untouched action button lie (apiFetch's Response.ok is purely status-code-based,
    // so any 2xx reads as success to every `vmsSend`/`useVmsData` caller regardless of body content).
    if (method === 'GET') return { status: 200, data: {} };
    return { status: 501, data: { error: 'Demo workflow — this action is not wired to persist in this preview build.', demo: true } };
}
