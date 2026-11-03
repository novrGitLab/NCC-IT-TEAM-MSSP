// Deterministic remediation plan for one finding. No AI service is involved: every sentence is a
// template filled from the stored finding, its asset and the severity/priority rules below. The
// plan is a proposal. Approving it records the decision and creates illustrative remediation
// tasks; it never applies a patch, changes a host or contacts any system.
import { randomUUID } from 'node:crypto';
import { loadState, saveState } from './store';
import { addExtraTask } from './engine';
import type { FindingRecord, SimState } from './types';
import type { VmsAsset } from '../contracts/vms';

const DEADLINE_DAYS: Record<string, number> = { P1: 1, P2: 3, P3: 14, P4: 30 };
const DECISION_ACTION = 'remediation_plan.decision';

export type PlanDecision = 'approved' | 'rejected';

export interface RemediationPlan {
    finding: {
        id: string; title: string; asset_id: string | null; asset_value: string; cve_ids: string[]; scanner_severity: string;
        priority: string | null; status: string; owner: string | null; due_at: string | null; first_seen: string; description: string | null;
    };
    asset: { id: string; value: string; criticality: string; exposure: string; owner: string | null } | null;
    business_impact: string;
    patch: { available: boolean; statement: string };
    recommendations: string[];
    checklist: { order: number; action: string; owner_suggestion: string | null; deadline_days: number }[];
    risk_priority: { priority: string; risk_score: number | null; rationale: string; due_at: string | null; overdue: boolean };
    review: { status: 'pending' | PlanDecision; decided_by: string | null; decided_at: string | null; reason: string | null };
    recorded_actions: { at: string; actor: string; action: string; details: string | null }[];
    generated_by: 'deterministic';
    disclaimer: string;
}

export function findingForId(state: SimState, id: string): FindingRecord | null {
    return state.findings.find((f) => f.id === id) ?? null;
}

function businessImpact(f: FindingRecord, asset: VmsAsset | null): string {
    const where = asset ? `${asset.value} (${asset.criticality} criticality, ${asset.exposure === 'internet' ? 'internet-facing' : asset.exposure})` : 'the affected asset';
    const sev = f.scanner_severity;
    if (sev === 'critical' && asset?.exposure === 'internet') {
        return `Critical and reachable from the internet: successful exploitation of ${where} could give an outside attacker control of the system.`;
    }
    if (sev === 'critical') return `Critical on ${where}: exploitation would need internal access, but could still lead to a wide compromise.`;
    if (sev === 'high') return `High severity on ${where}: exploitation is likely to cause material damage if the weakness is reached.`;
    if (sev === 'medium') return `Medium severity on ${where}: adds to an attack path rather than causing damage alone.`;
    return `Low severity on ${where}: limited direct impact; fix with routine maintenance.`;
}

function recommendationsFor(f: FindingRecord): string[] {
    const list: string[] = [];
    if (f.remediation) list.push(f.remediation);
    if (f.scanner_severity === 'critical' || f.scanner_severity === 'high') {
        list.push('Prioritise this ahead of lower-severity work on the same asset.');
    }
    list.push('After the fix, run a verification scan before closing the finding.');
    return list;
}

function checklistFor(f: FindingRecord, asset: VmsAsset | null): RemediationPlan['checklist'] {
    const priority = f.priority ?? 'P4';
    const days = DEADLINE_DAYS[priority] ?? 30;
    const owner = asset?.owner ?? f.owner ?? null;
    return [
        { order: 1, action: `Confirm the affected version and that ${f.asset_value} is in scope.`, owner_suggestion: owner, deadline_days: Math.min(days, 1) },
        {
            order: 2,
            action: f.patch_available
                ? 'Apply the vendor fix named in the recommendation during an approved change window.'
                : 'No vendor fix is recorded: apply the documented workaround or a compensating control, and track the fix separately.',
            owner_suggestion: owner, deadline_days: days,
        },
        { order: 3, action: 'Back up the asset and record the change in the change log before applying anything.', owner_suggestion: owner, deadline_days: days },
        { order: 4, action: 'Request a verification scan of the same check on the same target.', owner_suggestion: f.owner ?? null, deadline_days: days },
        { order: 5, action: 'Close the finding only after the verification scan confirms it is gone.', owner_suggestion: f.owner ?? null, deadline_days: days },
    ];
}

export function buildRemediationPlan(state: SimState, findingId: string, now: number): RemediationPlan | null {
    const f = findingForId(state, findingId);
    if (!f) return null;
    const asset = state.assets.find((a) => a.id === f.asset_id) ?? null;
    const decisions = state.auditLog.filter((e) => e.action === DECISION_ACTION && (e.details as { finding_id?: string } | undefined)?.finding_id === findingId);
    const last = decisions[decisions.length - 1];
    const detail = last?.details as { decision?: PlanDecision; reason?: string | null } | undefined;
    const actions = state.auditLog
        .filter((e) => (e.details as { finding_id?: string } | undefined)?.finding_id === findingId)
        .map((e) => ({ at: e.at, actor: e.actor, action: e.action, details: e.details ? JSON.stringify(e.details) : null }));
    const overdue = !!f.due_at && Date.parse(f.due_at) < now && !['verified', 'risk_accepted', 'false_positive'].includes(f.status);
    return {
        finding: {
            id: f.id, title: f.title, asset_id: f.asset_id ?? null, asset_value: f.asset_value, cve_ids: f.cve_ids, scanner_severity: f.scanner_severity,
            priority: f.priority ?? null, status: f.status, owner: f.owner ?? null, due_at: f.due_at ?? null, first_seen: f.first_seen, description: f.description ?? null,
        },
        asset: asset ? { id: asset.id, value: asset.value, criticality: asset.criticality, exposure: asset.exposure, owner: asset.owner ?? null } : null,
        business_impact: businessImpact(f, asset),
        patch: {
            available: !!f.patch_available,
            statement: f.patch_available ? 'A vendor fix is recorded for this finding.' : 'No vendor fix is recorded for this finding.',
        },
        recommendations: recommendationsFor(f),
        checklist: checklistFor(f, asset),
        risk_priority: {
            priority: f.priority ?? 'P4',
            risk_score: f.risk_score ?? null,
            rationale: `Priority ${f.priority ?? 'P4'} from ${f.scanner_severity} severity${asset ? `, ${asset.criticality} asset criticality and ${asset.exposure} exposure` : ''}${f.risk_score != null ? `; risk score ${f.risk_score}` : ''}.`,
            due_at: f.due_at ?? null,
            overdue,
        },
        review: { status: detail?.decision ?? 'pending', decided_by: last?.actor ?? null, decided_at: last?.at ?? null, reason: detail?.reason ?? null },
        recorded_actions: actions,
        generated_by: 'deterministic',
        disclaimer: 'Plan only. Nothing is applied to any system: approving it records the decision and creates tasks, and no patch is installed.',
    };
}

export class PlanError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

/** Records an analyst's approval or rejection. Each finding takes one decision; a second is refused. */
export async function decideRemediationPlan(findingId: string, decision: PlanDecision, actor: string, reason: string | null): Promise<void> {
    const state = loadState();
    const f = findingForId(state, findingId);
    if (!f) throw new PlanError(`No finding with ID "${findingId}". Check the ID in the Findings list.`, 404);
    if (decision === 'rejected' && !(reason && reason.trim())) throw new PlanError('A reason is required to reject a remediation plan.', 400);
    const already = state.auditLog.some((e) => e.action === DECISION_ACTION && (e.details as { finding_id?: string } | undefined)?.finding_id === findingId);
    if (already) throw new PlanError('This remediation plan already has a recorded decision.', 409);

    const plan = buildRemediationPlan(state, findingId, Date.now());
    await saveState((draft) => {
        draft.auditLog.push({
            id: `audit-${randomUUID()}`, at: new Date().toISOString(), actor, action: DECISION_ACTION,
            details: { finding_id: findingId, decision, reason: reason?.trim() || null },
        });
    });
    if (decision === 'approved' && plan) {
        for (const step of plan.checklist) {
            await addExtraTask(findingId, {
                title: step.action.slice(0, 300),
                owner: step.owner_suggestion ?? undefined,
                due_at: new Date(Date.now() + step.deadline_days * 86_400_000).toISOString(),
            });
        }
    }
}
