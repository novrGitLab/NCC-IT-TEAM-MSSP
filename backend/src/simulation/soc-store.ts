// Shared SOC records: alerts, cases and approval requests (the single source of truth for the SOC
// screens, the shift handover, the executive KPIs and the insights). Reads come from loadState();
// writes go through saveState(). Nothing here executes a response action: approvals and simulated
// steps are recorded, nothing is blocked, isolated, disabled or patched.
import { randomUUID } from 'node:crypto';
import { loadState, saveState } from './store';
import { runSocPolicy } from './soc-runtime';
import type { SimState, SocAlertRecord, SocApprovalRecord, SocApprovalStatus, SocCaseRecord, SocLifecycle, SocSeverity } from './types';

export class SocError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

const UI_STATUS: Record<SocLifecycle, string> = {
    new: 'new', monitoring: 'new', triaged: 'triaged', pending_approval: 'escalated', escalated: 'escalated', case_created: 'escalated',
    auto_closed: 'closed', manually_closed: 'closed', false_positive: 'false_positive',
};
const RULE_LEVEL: Record<SocSeverity, number> = { critical: 12, high: 9, medium: 6, low: 3, info: 1 };
const UI_TO_LIFECYCLE: Record<string, SocLifecycle> = { new: 'new', triaged: 'triaged', escalated: 'escalated', closed: 'manually_closed', false_positive: 'false_positive' };
const CASE_UI_STATUS = new Set(['open', 'investigating', 'contained', 'resolved']);

/** Runs a write and resolves to what the mutator returned (saveState itself resolves to the state). */
async function mutate<T>(fn: (draft: SimState) => T): Promise<T> {
    let out!: T;
    await saveState((draft) => { out = fn(draft); });
    return out;
}

export function nowMs(state: SimState = loadState()): number {
    return Date.parse(state.clock.nowIso);
}

/** Alert in the shape the existing alert screens read (StoredAlert), derived from the shared record. */
export function toStoredAlert(a: SocAlertRecord) {
    return {
        id: a.id, wazuh_alert_id: a.id, rule_id: a.rule_id, rule_level: RULE_LEVEL[a.severity],
        rule_description: a.title, agent_id: a.asset_id, agent_name: a.asset_value, agent_ip: null,
        severity: a.severity, mitre_ids: a.mitre_ids, wazuh_groups: [a.category], location: a.detection_source,
        raw_truncated: false, event_time: a.detected_at, received_at: a.detected_at,
        status: UI_STATUS[a.lifecycle] as 'new' | 'triaged' | 'escalated' | 'closed' | 'false_positive',
        case_id: a.case_id, src_ip: null, lifecycle: a.lifecycle, assigned_to: a.assigned_to,
        correlation_key: a.correlation_key, evidence_summary: a.evidence_summary, related_events: a.related_events,
        policy_history: a.policy_history, identity: a.identity,
    };
}

function caseItem(c: SocCaseRecord) {
    const critical = c.severity === 'critical';
    return {
        id: c.id, case_number: c.id.toUpperCase(), title: c.title, description: c.timeline[0]?.text ?? null,
        severity: c.severity, status: c.status, source: c.correlation_key ? 'soc_policy' : 'analyst',
        agent_id: c.asset_ids[0] ?? null, agent_name: c.asset_ids[0] ?? null, source_ip: null,
        rule_id: c.correlation_key?.split('|')[0] ?? null, rule_level: RULE_LEVEL[c.severity],
        mitre_technique: c.mitre[0]?.id ?? null, mitre_tactic: c.mitre[0]?.tactic || null,
        assigned_to: c.assigned_to, created_at: c.created_at, updated_at: c.updated_at, resolved_at: c.status === 'resolved' ? c.updated_at : null,
        tier: c.tier, auto_closed: c.auto_closed, containment_done: false, escalated: c.escalated,
        tags: critical ? ['critical'] : null, alert_ids: c.alert_ids, asset_ids: c.asset_ids, approval_ids: c.approval_ids,
    };
}

function approvalItem(a: SocApprovalRecord) {
    return {
        id: a.id, case_id: a.case_id, alert_id: a.alert_id, asset_id: a.asset_id, action: a.action, target: a.target, severity: a.severity,
        status: a.status, requested_at: a.requested_at, requested_by: a.requested_by, approver: a.approver, explanation: a.explanation,
        evidence: a.evidence, risk_impact: a.risk_impact, sla_due_at: a.sla_due_at, decided_at: a.decided_at, decided_by: a.decided_by,
        decision_reason: a.decision_reason, history: a.history, simulated: true,
    };
}

export function listAlerts(opts: { status?: string | null; severity?: string | null; q?: string | null; limit?: number } = {}) {
    const state = loadState();
    let rows = state.socAlerts.map(toStoredAlert);
    if (opts.status) rows = rows.filter((a) => a.status === opts.status);
    if (opts.severity) rows = rows.filter((a) => a.severity === opts.severity);
    if (opts.q) {
        const needle = opts.q.toLowerCase();
        rows = rows.filter((a) => `${a.rule_description} ${a.agent_name} ${a.id}`.toLowerCase().includes(needle));
    }
    rows.sort((x, y) => Date.parse(y.event_time) - Date.parse(x.event_time));
    const total = rows.length;
    return { alerts: rows.slice(0, opts.limit ?? 200), total };
}

export function getAlert(id: string) {
    const a = loadState().socAlerts.find((x) => x.id === id);
    return a ? toStoredAlert(a) : null;
}

export function alertEvents(id: string) {
    const a = loadState().socAlerts.find((x) => x.id === id);
    if (!a) return null;
    return a.related_events.map((e, i) => ({ id: `${a.id}-ev-${i + 1}`, at: e.at, text: e.text, source: a.detection_source }));
}

export function alertStatsShared() {
    const state = loadState();
    const byStatus: Record<string, number> = { new: 0, triaged: 0, escalated: 0, closed: 0, false_positive: 0 };
    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const a of state.socAlerts) {
        byStatus[UI_STATUS[a.lifecycle]] = (byStatus[UI_STATUS[a.lifecycle]] ?? 0) + 1;
        bySeverity[a.severity] += 1;
    }
    const newest = [...state.socAlerts].sort((x, y) => Date.parse(y.detected_at) - Date.parse(x.detected_at))[0];
    return {
        range: '24h', since: new Date(nowMs(state) - 24 * 3_600_000).toISOString(), total: state.socAlerts.length,
        by_severity: bySeverity, by_status: byStatus,
        automated_closures: state.socAlerts.filter((a) => a.lifecycle === 'auto_closed').length,
        escalated: state.socAlerts.filter((a) => a.lifecycle === 'escalated' || a.lifecycle === 'case_created').length,
        last_received_at: newest?.detected_at ?? null, last_event_time: newest?.detected_at ?? null, stale_after_minutes: 60,
    };
}

export async function setAlertStatus(id: string, uiStatus: string, actor: string) {
    const lifecycle = UI_TO_LIFECYCLE[uiStatus];
    if (!lifecycle) throw new SocError(`Unknown status "${uiStatus}".`, 400);
    return mutate((draft) => {
        const a = draft.socAlerts.find((x) => x.id === id);
        if (!a) throw new SocError('Alert not found.', 404);
        const at = new Date(nowMs(draft)).toISOString();
        a.lifecycle = lifecycle;
        a.related_events.push({ at, text: `Status set to ${uiStatus.replace(/_/g, ' ')} by ${actor}.` });
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at, actor, action: 'alert.status_changed', details: { alert_id: id, status: uiStatus } });
        return toStoredAlert(a);
    });
}

/** Opens a case for an alert, or returns the case the alert already belongs to (never a second one). */
export function attachAlertToCase(id: string, actor: string) {
    return mutate((draft) => {
        const a = draft.socAlerts.find((x) => x.id === id);
        if (!a) throw new SocError('Alert not found.', 404);
        if (a.case_id) return { case_id: a.case_id, created: false };
        const existing = draft.socCases.find((c) => c.correlation_key === a.correlation_key && c.status !== 'resolved');
        const at = new Date(nowMs(draft)).toISOString();
        let caseId = existing?.id;
        if (!caseId) {
            const max = draft.socCases.reduce((m, c) => Math.max(m, Number(/^case-(\d+)$/.exec(c.id)?.[1] ?? 0)), 5000);
            caseId = `case-${max + 1}`;
            draft.socCases.push({
                id: caseId, title: a.title, severity: a.severity, status: 'open', tier: a.severity === 'critical' ? 3 : 2, correlation_key: a.correlation_key,
                asset_ids: [a.asset_id], alert_ids: [], assigned_to: a.severity === 'critical' ? 'Priya Raman' : null, created_at: at, updated_at: at,
                timeline: [{ at, text: `Case opened by ${actor} from alert ${a.id}.` }], notes: [], recommended_actions: [], approval_ids: [],
                auto_closed: false, escalated: false, mitre: a.mitre_ids.map((t) => ({ id: t, tactic: '' })),
            });
        }
        const c = draft.socCases.find((x) => x.id === caseId) as SocCaseRecord;
        if (!c.alert_ids.includes(a.id)) c.alert_ids.push(a.id);
        c.updated_at = at;
        a.case_id = caseId;
        a.lifecycle = 'case_created';
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at, actor, action: 'alert.case_attached', details: { alert_id: id, case_id: caseId } });
        return { case_id: caseId, created: !existing };
    });
}

export function listCases(opts: { excludeAutoClosed?: boolean; since?: string | null; limit?: number } = {}) {
    const state = loadState();
    let rows = state.socCases.filter((c) => (opts.excludeAutoClosed ? !c.auto_closed : true));
    if (opts.since) {
        const t = Date.parse(opts.since);
        if (!Number.isNaN(t)) rows = rows.filter((c) => Date.parse(c.created_at) >= t);
    }
    rows = [...rows].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
    const items = rows.slice(0, opts.limit ?? 200).map(caseItem);
    return { cases: items, total: rows.length, summary: casesSummaryShared() };
}

export function casesSummaryShared() {
    const cs = loadState().socCases;
    const count = (s: string) => cs.filter((c) => c.status === s).length;
    const open = count('open');
    const investigating = count('investigating');
    const contained = count('contained');
    return {
        total: cs.length, open, investigating, contained, resolved: count('resolved'),
        active: open + investigating + contained,
        critical: cs.filter((c) => c.status !== 'resolved' && c.severity === 'critical').length,
        resolvedToday: cs.filter((c) => c.status === 'resolved').length,
    };
}

export function getCaseDetail(id: string) {
    const c = loadState().socCases.find((x) => x.id === id);
    if (!c) return null;
    const state = loadState();
    const linkedIds = new Set(c.alert_ids);
    return {
        case: caseItem(c),
        notes: c.notes.map((n) => ({ id: n.id, author: n.author, type: 'note', content: n.text, created_at: n.at })),
        tasks: c.recommended_actions.map((r) => ({ id: r.id, step_id: r.action, title: r.action, description: r.target, status: r.requires_approval ? 'pending_approval' : 'open', result: 'Simulated; not executed', executed_by: null })),
        timeline: c.timeline.map((t, i) => ({ id: `${c.id}-tl-${i + 1}`, actor: 'system', action: t.text, details: null, automated: true, created_at: t.at })),
        iocs: [],
        linked: state.socAlerts.filter((a) => linkedIds.has(a.id)).map((a) => ({ id: a.id, case_number: a.id, title: a.title, severity: a.severity, status: 'open', created_at: a.detected_at, reason: a.evidence_summary })),
        approvals: state.socApprovals.filter((a) => a.case_id === c.id).map(approvalItem),
    };
}

export function patchCase(id: string, changes: { status?: string; assigned_to?: string | null }, actor: string) {
    return mutate((draft) => {
        const c = draft.socCases.find((x) => x.id === id);
        if (!c) throw new SocError('Case not found.', 404);
        const at = new Date(nowMs(draft)).toISOString();
        if (changes.status !== undefined) {
            if (!CASE_UI_STATUS.has(changes.status)) throw new SocError(`Unknown case status "${changes.status}".`, 400);
            if (changes.status !== c.status) c.timeline.push({ at, text: `Status changed from ${c.status} to ${changes.status} by ${actor}.` });
            c.status = changes.status as SocCaseRecord['status'];
        }
        if (changes.assigned_to !== undefined) {
            c.assigned_to = changes.assigned_to;
            c.timeline.push({ at, text: `Assigned to ${changes.assigned_to ?? 'no one'} by ${actor}.` });
        }
        c.updated_at = at;
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at, actor, action: 'case.updated', details: { case_id: id, ...changes } });
        return caseItem(c);
    });
}

export function escalateCase(id: string, actor: string) {
    return mutate((draft) => {
        const c = draft.socCases.find((x) => x.id === id);
        if (!c) throw new SocError('Case not found.', 404);
        const at = new Date(nowMs(draft)).toISOString();
        c.escalated = true;
        c.tier = Math.min(3, c.tier + 1);
        c.timeline.push({ at, text: `Escalated to tier ${c.tier} by ${actor}.` });
        c.updated_at = at;
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at, actor, action: 'case.escalated', details: { case_id: id, tier: c.tier } });
        return caseItem(c);
    });
}

/** Records that an analyst marked a planned step done. Nothing is executed. */
export function recordSimulatedStep(id: string, stepId: string, actor: string) {
    return mutate((draft) => {
        const c = draft.socCases.find((x) => x.id === id);
        if (!c) throw new SocError('Case not found.', 404);
        const at = new Date(nowMs(draft)).toISOString();
        c.timeline.push({ at, text: `Step "${stepId}" recorded by ${actor} (simulated; no action executed).` });
        c.updated_at = at;
        return { message: 'Step recorded (simulated; no action was executed).', case: caseItem(c) };
    });
}

export function listApprovals(status?: string | null) {
    const rows = loadState().socApprovals.filter((a) => (status ? a.status === status : true));
    return { approvals: rows.map(approvalItem), total: rows.length };
}

export function getApproval(id: string) {
    const a = loadState().socApprovals.find((x) => x.id === id);
    return a ? approvalItem(a) : null;
}

/** Records a human decision. Each request takes one final decision; information requests keep it open. */
export function decideApproval(id: string, decision: 'approved' | 'rejected' | 'info_requested', actor: string, reason: string | null) {
    return mutate((draft) => {
        const a = draft.socApprovals.find((x) => x.id === id);
        if (!a) throw new SocError('Approval request not found.', 404);
        if (a.status === 'approved' || a.status === 'rejected') throw new SocError(`This request was already ${a.status}; it cannot be decided again.`, 409);
        const trimmed = reason?.trim() || null;
        if (decision === 'rejected' && !trimmed) throw new SocError('A reason is required to reject a request.', 400);
        if (decision === 'info_requested' && !trimmed) throw new SocError('Say what further investigation is needed.', 400);
        const at = new Date(nowMs(draft)).toISOString();
        a.status = decision as SocApprovalStatus;
        a.history.push({ at, actor, action: decision, reason: trimmed });
        if (decision !== 'info_requested') {
            a.decided_at = at;
            a.decided_by = actor;
            a.decision_reason = trimmed;
        }
        const c = draft.socCases.find((x) => x.id === a.case_id);
        if (c) {
            const label = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'returned for further investigation';
            c.timeline.push({ at, text: `Approval ${label} by ${actor}: ${a.action.replace(/_/g, ' ')} on ${a.target} (not executed).` });
            c.updated_at = at;
        }
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at, actor, action: `approval.${decision}`, details: { approval_id: id, case_id: a.case_id, action: a.action, reason: trimmed } });
        return approvalItem(a);
    });
}

/** Admin control for the illustrative environment: moves the shared clock forward and runs the policy. */
export async function advanceSimulationTime(minutes: number, actor: string) {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) throw new SocError('Advance by between 1 and 1440 minutes.', 400);
    return mutate((draft) => {
        draft.clock.nowIso = new Date(Date.parse(draft.clock.nowIso) + minutes * 60_000).toISOString();
        const now = Date.parse(draft.clock.nowIso);
        const run = runSocPolicy(draft, now);
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at: draft.clock.nowIso, actor, action: 'clock.advanced', details: { minutes, policy_changes: run.changes } });
        return { now: draft.clock.nowIso, policy_changes: run.changes, decisions: run.decisions };
    });
}

/** Recent SOC events for the live timeline: policy decisions, approvals, case and clock changes. */
export function recentEvents(limit = 25) {
    const state = loadState();
    return state.auditLog
        .filter((e) => /^(soc_policy|approval|case|alert|clock)\./.test(e.action))
        .slice(-limit)
        .reverse()
        .map((e) => ({ id: e.id, at: e.at, actor: e.actor, action: e.action, details: e.details ?? null }));
}
