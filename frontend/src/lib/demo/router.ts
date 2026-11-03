// NCC IT — interception point for API calls not yet migrated to a real route handler. Several
// domains (auth, VMS assets/findings/scans/risk/remediation/tasks) have been ported to real
// src/app/api/**/route.ts handlers backed by the persistent simulation engine
// (src/lib/simulation/) — see src/lib/api.ts's isPortedPath() for which. Everything below still
// answers from these in-memory fixtures until it's ported too. Unmatched paths get an honest
// empty-but-valid response, never a fake success payload shaped like a crash or a silent 200 with
// lies.

import { DEMO_ALERTS, alertStats, byAlertId, patchAlert } from './alerts';
import { DEMO_CASES, casesSummary, DEMO_PLAYBOOKS, DEMO_APPROVALS } from './incidents';
import { DEMO_TI_FEEDS, DEMO_TI_OVERVIEW, DEMO_TI_ACTORS, DEMO_TI_SOURCE_NAMED, DEMO_TI_ACTOR_NOTES, DEMO_TI_MATCHES, DEMO_TI_MAP_POINTS, DEMO_TI_VULNERABILITIES } from './threats';
import { DEMO_WEEKLY_INSIGHTS, DEMO_REPORTS } from './reports';
import { DEMO_WORKER_STATUS, DEMO_DEPLOYMENT_STEPS } from './collectors';

export interface DemoResponse {
    status: number;
    data: unknown;
}

function parseBody(body: unknown): Record<string, unknown> {
    if (!body) return {};
    if (typeof body === 'string') { try { return JSON.parse(body); } catch { return {}; } }
    return body as Record<string, unknown>;
}

/** path = pathname only (no origin); query = URLSearchParams already parsed from the same URL. */
export function demoRespond(method: string, path: string, query: URLSearchParams, rawBody: unknown): DemoResponse {
    const body = parseBody(rawBody);

    // --- VMS: endpoints not yet ported to a route handler ---
    if (path === '/api/vms/services') return { status: 200, data: { services: [{ id: 'svc-1', name: 'Vulnerability scanning', status: 'active' }, { id: 'svc-2', name: 'Continuous discovery', status: 'active' }] } };
    if (path === '/api/vms/scopes') return { status: 200, data: { scopes: [{ id: 'scope-1', name: 'Production network', cidrs: ['10.20.0.0/16'], approved: true }] } };
    if (path === '/api/vms/profiles') return { status: 200, data: { profiles: [{ id: 'profile-1', name: 'Standard weekly scan', kinds: ['discovery', 'ports', 'vuln_nuclei'] }] } };
    if (path === '/api/vms/operations') {
        return {
            status: 200,
            data: {
                engines: [
                    { id: 'discovery', label: 'Discovery', kind: 'discovery', state: 'available', note: '', versions: ['1.8.2'] },
                    { id: 'ports', label: 'Ports & services', kind: 'ports', state: 'available', note: '', versions: ['1.8.2'] },
                    { id: 'vuln_nuclei', label: 'Nuclei', kind: 'vuln_nuclei', state: 'available', note: '', versions: ['1.8.2'] },
                    { id: 'vuln_openvas', label: 'OpenVAS', kind: 'vuln_openvas', state: 'not_enabled', note: 'Disabled in this evaluation environment', versions: [] },
                ],
                worker_presence: { state: 'online', source: 'simulation', online_workers: DEMO_WORKER_STATUS.workers.length, last_seen_at: DEMO_WORKER_STATUS.workers[0]?.last_seen ?? null },
                queue: { queued: 0, running: 1, oldest_queued_at: null },
                last_7_days: {},
                active: [],
                recent_failures: [],
                wazuh_sync: { last_attempt_at: new Date(Date.now() - 3_600_000).toISOString(), last_complete_at: new Date(Date.now() - 3_600_000).toISOString(), complete: true, problem: null },
            },
        };
    }
    if (path === '/api/vms/ai-plans') return { status: 200, data: { plans: [] } };
    if (path === '/api/vms/assessments') return { status: 200, data: { assessments: [] } };
    if (path === '/api/vms/audit') return { status: 200, data: { entries: [] } };
    if (path === '/api/vms/schedules') return { status: 200, data: { schedules: [{ id: 'sched-1', name: 'Weekly discovery + Nuclei', kinds: ['discovery', 'vuln_nuclei'], cron: '0 2 * * 1', enabled: true }] } };
    if (path === '/api/vms/admin/policies') return { status: 200, data: { policies: [{ id: 'policy-1', name: 'Standard scan policy', kinds: ['discovery', 'ports', 'vuln_nuclei'] }] } };

    // --- Threat Intelligence ---
    if (path === '/api/ti/overview') {
        return {
            status: 200,
            data: {
                indicators: { active: DEMO_TI_OVERVIEW.total_indicators, new_last_24h: DEMO_TI_OVERVIEW.new_last_24h, by_type: { ip: 1, domain: 0, hash: 0, url: 1 } },
                matches: { new: DEMO_TI_MATCHES.filter((m) => m.status === 'new').length, total: DEMO_TI_MATCHES.length },
                feeds: DEMO_TI_FEEDS,
            },
        };
    }
    if (path === '/api/ti/actors') return { status: 200, data: { actors: DEMO_TI_ACTORS, source_named: DEMO_TI_SOURCE_NAMED, notes: DEMO_TI_ACTOR_NOTES } };
    if (path === '/api/ti/matches') return { status: 200, data: { matches: DEMO_TI_MATCHES } };
    if (path === '/api/ti/map') return { status: 200, data: { points: DEMO_TI_MAP_POINTS } };
    if (path === '/api/ti/vulnerabilities') return { status: 200, data: { vulnerabilities: DEMO_TI_VULNERABILITIES, total: DEMO_TI_VULNERABILITIES.length } };
    if (path.startsWith('/api/ti/reports')) return { status: 200, data: { reports: DEMO_REPORTS } };
    if (path.startsWith('/api/ti/exchange/clients')) return { status: 200, data: { clients: [] } };
    if (path.startsWith('/api/ti/sources/misp/check')) return { status: 200, data: { misp: { ok: false, message: 'MISP is not connected in this evaluation environment.' } } };
    if (/^\/api\/ti\/feeds\/[^/]+\/run$/.test(path) && method === 'POST') return { status: 200, data: { status: 'ok', counts: { new: 0 } } };

    // --- SecOps / Cases / Alerts ---
    if (path === '/api/cases' || path === '/api/incidents') return { status: 200, data: { cases: DEMO_CASES, total: DEMO_CASES.length, summary: casesSummary() } };
    {
        // CaseWorkbench.tsx reads `data.case.id` — a bare case object here (no `.case` wrapper)
        // threw a TypeError on open, crashing the detail view rather than just showing it empty.
        const m = path.match(/^\/api\/(?:cases|incidents)\/([^/]+)$/);
        if (m) {
            const found = DEMO_CASES.find((c) => c.id === m[1]);
            if (!found) return { status: 404, data: { error: 'Case not found' } };
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
            if (!found) return { status: 404, data: { error: 'Case not found' } };
            if (action[2] === 'report') return { status: 200, data: { report_url: null, message: 'Report generation is simulated; no file is produced in this environment.' } };
            found.timeline.push({ at: new Date().toISOString(), text: action[2] === 'escalate' ? 'Escalated (simulated — no real notification sent).' : 'Playbook step marked complete (simulated — no real response action executed).' });
            found.updated_at = new Date().toISOString();
            return { status: 200, data: { message: action[2] === 'escalate' ? 'Case escalated.' : 'Step recorded.', case: found } };
        }
    }
    if (path === '/api/communications/recipients') return { status: 200, data: { recipients: [{ name: 'SOC Mailbox', email: 'soc@ncc-soc.local' }] } };
    {
        const m = path.match(/^\/api\/playbooks\/([^/]+)\/run$/);
        if (m && method === 'POST') return { status: 200, data: { message: 'Playbook run is simulated; no real response action was executed.', run_id: `run-sim-${Date.now()}` } };
    }
    if (path === '/api/playbooks') return { status: 200, data: { playbooks: DEMO_PLAYBOOKS } };
    if (path.startsWith('/api/approvals') || path.startsWith('/api/soar/response-requests')) return { status: 200, data: { approvals: DEMO_APPROVALS } };
    if (path === '/api/alerts/stats') return { status: 200, data: alertStats() };
    {
        // Specific /api/alerts/:id... routes MUST be checked before the plain-list catch-all below —
        // that catch-all previously matched every one of these too (startsWith) and returned the
        // whole alert LIST in place of a single alert or an action result.
        const events = path.match(/^\/api\/alerts\/([^/]+)\/events$/);
        if (events) return { status: 200, data: { events: [] } };
        const statusAction = path.match(/^\/api\/alerts\/([^/]+)\/status$/);
        if (statusAction && (method === 'POST' || method === 'PATCH')) {
            const updated = patchAlert(statusAction[1], { status: body.status as never });
            return updated ? { status: 200, data: { alert: updated, message: 'Status change applied to this session only, not sent to Wazuh.' } } : { status: 404, data: { error: 'Alert not found' } };
        }
        const caseAction = path.match(/^\/api\/alerts\/([^/]+)\/case$/);
        if (caseAction && method === 'POST') {
            const a = byAlertId(caseAction[1]);
            if (!a) return { status: 404, data: { error: 'Alert not found' } };
            if (a.case_id) return { status: 200, data: { case_id: a.case_id, message: 'This alert already has a case.' } };
            const newCase = { id: `case-sim-${Date.now()}`, title: a.rule_description ?? 'New case', severity: a.severity, status: 'open' as const, tier: 1 as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), assigned_to: null, agent_name: a.agent_name ?? 'unknown', mitre: (a.mitre_ids ?? []).map((id) => ({ id, tactic: 'Unknown' })), timeline: [{ at: new Date().toISOString(), text: `Case created manually from alert ${a.id}.` }] };
            DEMO_CASES.push(newCase);
            patchAlert(a.id, { case_id: newCase.id });
            return { status: 200, data: { case_id: newCase.id, message: 'Case created.' } };
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
    // dashboard's Agents KPI silently show "—" instead of simulated data.
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
                source: 'simulation',
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
    if (path.startsWith('/api/platform/health')) {
        // "operational" with every monitored service up — consistent with /api/wazuh/status
        // above reporting the manager as connected in this environment.
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
    // from the live case list (casesSummary) so this can't show a different case count than Cases/SecOps.
    {
        const closed = DEMO_CASES.filter((c) => c.status === 'closed');
        const monthly = [
            { month: 'Aug', sla_rate: 88, resolved: 3 },
            { month: 'Sep', sla_rate: 90, resolved: 4 },
            { month: 'Oct', sla_rate: 92, resolved: closed.length },
        ];
        const definitions = { sla_target_hours: { critical: 4, high: 8, medium: 24, low: 72 }, sla_secure_threshold_pct: 85, detection_time: 'Not tracked yet — requires a connected detection pipeline.' };
        const summary = casesSummary();
        const posture = summary.critical > 0 ? 'at_risk' : 'secure';
        if (path === '/api/client/security-assessment') {
            return {
                status: 200,
                data: {
                    org_id: 'org-demo-1', org_name: 'NCC IT Evaluation Org', detection_time_hrs: null,
                    response_time_hrs: 1.4, response_sample: DEMO_CASES.length, close_time_hrs: closed.length ? 6.2 : null,
                    open_cases: summary.active, closed_this_month: closed.length, resolved_30d: closed.length,
                    sla_rate: closed.length ? 92 : null, posture, trend: 'stable', monthly,
                    last_closed: closed.map((c) => ({ id: c.id, case_number: c.id, title: c.title, severity: c.severity, close_time_hrs: 6.2, within_sla: true, resolved_at: c.updated_at })),
                    engagement: { score: 72, components: [
                        { key: 'response', label: 'Response time', max: 40, value: 32, reason: 'Average response time across recent cases' },
                        { key: 'closure', label: 'Case closure', max: 30, value: 24, reason: 'Cases closed within SLA' },
                        { key: 'playbooks', label: 'Playbook usage', max: 30, value: 16, reason: 'Share of cases run through a playbook' },
                    ] },
                    orgs: [{ slug: 'demo-org', name: 'NCC IT Evaluation Org' }], definitions,
                },
            };
        }
        if (path === '/api/admin/security-assessment/overview') {
            return {
                status: 200,
                data: {
                    summary: { active_clients: 1, avg_detection_time_hrs: null, avg_close_time_hrs: closed.length ? 6.2 : null, open_cases: summary.active, sla_rate: closed.length ? 92 : null, clients_below_sla: 0 },
                    clients: [{ org_id: 'org-demo-1', org_name: 'NCC IT Evaluation Org', detection_time_hrs: null, close_time_hrs: closed.length ? 6.2 : null, open_cases: summary.active, closed_this_month: closed.length, resolved_30d: closed.length, sla_rate: closed.length ? 92 : null, posture, trend: 'stable', last_updated: new Date().toISOString() }],
                    monthly, definitions, generated_at: new Date().toISOString(),
                },
            };
        }
    }

    // --- Onboarding / Collectors ---
    // /api/organisations*, /api/admin/collectors and /api/collectors* are now real route handlers
    // backed by the simulation engine (src/app/api/organisations/**, src/app/api/collectors/**) —
    // see src/lib/api.ts's isPortedPath(). Only the deployment-steps walkthrough text remains here.
    if (path.startsWith('/api/onboarding/deployment-steps')) return { status: 200, data: { steps: DEMO_DEPLOYMENT_STEPS } };

    // --- Settings (trivial fixed answers) ---
    if (path === '/api/admin/team/presence') {
        return {
            status: 200,
            data: {
                members: [
                    { email: 'admin@ncc-soc.local', name: 'Administrator', role: 'super_admin', account_status: 'active', status: 'online', last_active: new Date().toISOString(), active_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], cases_assigned: DEMO_CASES.filter((c) => c.assigned_to === 'Administrator').length, avg_response_hrs: 1.4, response_sample: DEMO_CASES.length },
                    { email: 'analyst@ncc-soc.local', name: 'SOC Analyst', role: 'analyst', account_status: 'active', status: 'away', last_active: new Date(Date.now() - 20 * 60_000).toISOString(), active_days: ['Mon', 'Tue', 'Wed'], cases_assigned: 2, avg_response_hrs: 2.1, response_sample: 4 },
                ],
                history: 'since_restart', generated_at: new Date().toISOString(),
            },
        };
    }
    if (path.startsWith('/api/admin/team') || path.startsWith('/api/admin/users')) return { status: 200, data: { users: [{ id: 'u1', name: 'Administrator', role: 'super_admin', email: 'admin@ncc-soc.local' }] } };
    if (path === '/api/admin/push-status') {
        return {
            status: 200,
            data: {
                config: { enabled: false, valid: false, error: null, host: null, orgs: [], profile: null, max_per_min: null, timeout_ms: null, auth_header: null },
                runtime: { started_at: null, not_started_reason: 'Stellar Push is not configured in this evaluation environment.', last_tick_at: null, consecutive_failures: 0, next_attempt_at: null, last_result: null },
                state: null,
                backlog: null,
                dead_letters: null,
            },
        };
    }
    if (path.startsWith('/api/settings')) return { status: 200, data: {} };

    // --- Fallback: honest empty-but-valid for reads, honest FAILURE for writes — a 200 here would
    // make every untouched action button lie (apiFetch's Response.ok is purely status-code-based,
    // so any 2xx reads as success to every `vmsSend`/`useVmsData` caller regardless of body content).
    if (method === 'GET') return { status: 200, data: {} };
    return { status: 501, data: { error: 'This action is not wired to persist in this evaluation environment.', demo: true } };
}
