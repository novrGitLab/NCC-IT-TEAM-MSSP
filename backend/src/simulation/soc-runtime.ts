// Applies the deterministic SOC policy (soc-policy.ts) to the shared SOC records. Pure over a
// SimState draft, so it runs inside the same saveState() write as the clock change that triggers
// it. Only alerts still under automatic handling (lifecycle new or monitoring) are decided; alerts
// a person has triaged, closed or marked false positive are left alone.
import { evaluateGroup, type AlertEvent, type AlertGroup, type Decision } from './soc-policy';
import type { PolicyHistoryEntry, SimState, SocAlertRecord, SocApprovalRecord, SocCaseRecord, SocSeverity } from './types';

const ACTIVE = ['new', 'monitoring'];
const CLOSED_LIFECYCLES = ['auto_closed', 'manually_closed', 'false_positive'];
const ON_CALL = 'Priya Raman';

/** Maps a policy action to its effect class, so a repeated decision compares equal. */
function effectOf(action: string): 'case' | 'monitor' | 'auto_close' {
    if (action === 'auto_close') return 'auto_close';
    if (action === 'monitor') return 'monitor';
    return 'case';
}

const SEVERITY_ORDER: SocSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
const maxSeverity = (xs: SocSeverity[]): SocSeverity => xs.reduce((m, s) => (SEVERITY_ORDER.indexOf(s) > SEVERITY_ORDER.indexOf(m) ? s : m), 'info' as SocSeverity);

function nextCaseId(cases: SocCaseRecord[]): string {
    const max = cases.reduce((m, c) => {
        const n = Number(/^case-(\d+)$/.exec(c.id)?.[1] ?? 0);
        return Math.max(m, n);
    }, 5000);
    return `case-${max + 1}`;
}

function recommendedActionFor(alert: SocAlertRecord): { action: string; target: string } {
    if (alert.category === 'Command and control' || alert.category === 'Exploit attempt on exposed application') return { action: 'isolate_agent', target: alert.asset_value };
    if (alert.category === 'Privileged account anomaly') return { action: 'reset_credentials', target: alert.identity ?? alert.asset_value };
    return { action: 'review_evidence', target: alert.asset_value };
}

function pushAudit(state: SimState, at: string, action: string, details: Record<string, unknown>) {
    state.auditLog.push({ id: `audit-${state.auditLog.length + 1}-${at}`, at, actor: 'policy', action, details });
}

export interface PolicyRunResult { changes: number; decisions: { group: string; action: string; reason: string }[] }

/** Evaluates every correlation group with active alerts at clock value `nowMs`, applies the result,
 *  and returns how many alerts changed. Running it again at the same clock changes nothing. */
export function runSocPolicy(state: SimState, nowMs: number): PolicyRunResult {
    const nowIso = new Date(nowMs).toISOString();
    const result: PolicyRunResult = { changes: 0, decisions: [] };
    const keys = [...new Set(state.socAlerts.map((a) => a.correlation_key))].sort();

    for (const key of keys) {
        const members = state.socAlerts.filter((a) => a.correlation_key === key);
        const active = members.filter((a) => ACTIVE.includes(a.lifecycle));
        if (active.length === 0) continue;

        const events: AlertEvent[] = members.map((a) => ({
            at: Date.parse(a.detected_at), severity: a.severity, rule: a.rule_id, asset_id: a.asset_id, identity: a.identity,
        }));
        const linkedCaseId = members.find((a) => a.case_id)?.case_id ?? null;
        const group: AlertGroup = {
            key,
            events,
            unresolved_compromise_indicator: members.some((a) => a.severity === 'critical' && !CLOSED_LIFECYCLES.includes(a.lifecycle)),
            existing_case_id: linkedCaseId ?? state.socCases.find((c) => c.correlation_key === key && c.status !== 'resolved')?.id ?? null,
            critical_case_correlated: state.socCases.some((c) => c.severity === 'critical' && c.status !== 'resolved' && members.some((m) => m.case_id === c.id)),
        };
        const verdict = evaluateGroup(group, nowMs);
        const decision: Decision = verdict.decision;
        const effect = effectOf(decision.action);
        result.decisions.push({ group: key, action: decision.action, reason: decision.reason });

        let caseId: string | null = null;
        if (effect === 'case') {
            caseId = group.existing_case_id;
            if (!caseId) {
                const severity = maxSeverity(members.map((m) => m.severity));
                const id = nextCaseId(state.socCases);
                const head = members[0];
                const rec: SocCaseRecord = {
                    id, title: head.title, severity, status: 'open', tier: severity === 'critical' ? 3 : 2, correlation_key: key,
                    asset_ids: [...new Set(members.map((m) => m.asset_id))], alert_ids: [], assigned_to: severity === 'critical' ? ON_CALL : null,
                    created_at: nowIso, updated_at: nowIso,
                    timeline: [{ at: nowIso, text: `Case created by SOC policy: ${decision.reason}` }],
                    notes: [], recommended_actions: [], approval_ids: [], auto_closed: false, escalated: decision.action === 'escalate_case',
                    mitre: [...new Set(members.flatMap((m) => m.mitre_ids))].map((t) => ({ id: t, tactic: '' })),
                };
                state.socCases.push(rec);
                caseId = id;
            }
            const caseRec = state.socCases.find((c) => c.id === caseId);
            if (caseRec) {
                caseRec.updated_at = nowIso;
                for (const m of members) if (!caseRec.alert_ids.includes(m.id)) caseRec.alert_ids.push(m.id);
                if (decision.action === 'escalate_case') caseRec.escalated = true;
                if (caseRec.severity === 'critical' && !caseRec.assigned_to) caseRec.assigned_to = ON_CALL;
                if (caseRec.severity === 'critical') {
                    const rec = recommendedActionFor(members[0]);
                    const exists = state.socApprovals.some((x) => x.case_id === caseRec.id && x.action === rec.action);
                    if (!exists) {
                        const approvalId = `appr-${state.socApprovals.length + 1}`;
                        const approval: SocApprovalRecord = {
                            id: approvalId, case_id: caseRec.id, alert_id: members[0].id, asset_id: members[0].asset_id, action: rec.action, target: rec.target,
                            severity: 'critical', status: 'pending', requested_at: nowIso, requested_by: 'SOC policy (critical-alert rule)',
                            approver: caseRec.assigned_to, explanation: `Policy: ${rec.action.replace(/_/g, ' ')} is a sensitive response and needs a human decision. Advisory only.`,
                            evidence: members.map((m) => `${m.id}: ${m.title}`), risk_impact: 'Not assessed by policy; the approver decides.',
                            sla_due_at: new Date(nowMs + 60 * 60_000).toISOString(), decided_at: null, decided_by: null, decision_reason: null,
                            history: [{ at: nowIso, actor: 'SOC policy', action: 'requested', reason: null }],
                        };
                        state.socApprovals.push(approval);
                        caseRec.approval_ids.push(approvalId);
                        caseRec.timeline.push({ at: nowIso, text: `Approval requested: ${rec.action.replace(/_/g, ' ')} on ${rec.target} (not executed).` });
                        pushAudit(state, nowIso, 'soc_policy.approval_requested', { approval_id: approvalId, case_id: caseRec.id, action: rec.action });
                    }
                }
            }
        }

        for (const m of active) {
            const last = m.policy_history[m.policy_history.length - 1];
            if (last && effectOf(last.action) === effect && (effect !== 'case' || m.case_id === caseId)) continue;

            const entry: PolicyHistoryEntry = {
                at: nowIso, action: decision.action, reason: decision.reason, policy_version: verdict.policy_version,
                evidence: {
                    event_count: verdict.evidence.event_count, longest_continuous_ms: verdict.evidence.longest_continuous_ms,
                    quiet_ms: verdict.evidence.quiet_ms, window_ends_at: verdict.evidence.window_ends_at ? new Date(verdict.evidence.window_ends_at).toISOString() : null,
                    highest_severity: verdict.evidence.highest_severity,
                },
            };
            m.policy_history.push(entry);
            if (effect === 'auto_close') {
                if (m.severity === 'critical') continue;
                m.lifecycle = 'auto_closed';
            } else if (effect === 'monitor') {
                if (m.lifecycle === 'new') m.lifecycle = 'monitoring';
            } else {
                m.case_id = caseId;
                m.lifecycle = decision.action === 'escalate_case' ? 'escalated' : 'case_created';
            }
            result.changes += 1;
            pushAudit(state, nowIso, 'soc_policy.decision', { alert_id: m.id, group: key, action: decision.action, reason: decision.reason, policy_version: verdict.policy_version, case_id: m.case_id });
        }
    }
    return result;
}
