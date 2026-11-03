// Weekly insight facts (GET /api/insights/weekly). Counted from the shared engine records only.
// SOC alerts and cases are not yet stored in the engine, so their sections are reported as null
// rather than estimated from browser-side fixtures.
import type { FindingRecord, SimState } from './types';

const DAY_MS = 86_400_000;
const CLOSED = ['verified', 'risk_accepted', 'false_positive'];

export interface WeeklyFacts {
    period: { from: string; to: string; days: number; previous_from: string };
    vulnerabilities: {
        open_now: number; open_by_priority: Record<string, number>; overdue_now: number;
        new_in_period: number; new_in_previous: number; new_p1_p2_in_period: number;
        verified_in_period: number; verified_in_previous: number;
    };
    scans: { in_period: number; in_previous: number; by_status: Record<string, number> };
    assets: { active: number; by_criticality: Record<string, number>; open_critical_assets: number };
    alerts: {
        total: number; by_severity: Record<string, number>; by_status: Record<string, number>; new_in_period: number; new_in_previous: number;
        automated_closures: number; escalated: number;
    };
    cases: {
        opened_in_period: number; opened_in_previous: number; active: number; critical_active: number;
        by_severity_opened: Record<string, number>; escalated: number; auto_closed: number; workload: Record<string, number>;
    };
    health: { name: string; status: 'ok' | 'unknown'; detail: string }[];
    limitations: string[];
    generated_at: string;
}

const inRange = (iso: string | null | undefined, from: number, to: number) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return t >= from && t < to;
};

function countBy<T>(items: T[], key: (t: T) => string | null | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of items) {
        const k = key(item);
        if (k) out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}

export function buildWeeklyFacts(state: SimState, days: number, now: number): WeeklyFacts {
    const from = now - days * DAY_MS;
    const previousFrom = from - days * DAY_MS;
    const open = state.findings.filter((f: FindingRecord) => !CLOSED.includes(f.status));
    const activeAssets = state.assets.filter((a) => a.status === 'active');
    const scansIn = state.scans.filter((s) => inRange(s.requested_at, from, now));
    const scansPrev = state.scans.filter((s) => inRange(s.requested_at, previousFrom, from));
    const newIn = state.findings.filter((f) => inRange(f.first_seen, from, now));
    const newPrev = state.findings.filter((f) => inRange(f.first_seen, previousFrom, from));
    const verifiedIn = state.findings.filter((f) => f.status === 'verified' && inRange(f.verified_at, from, now));
    const verifiedPrev = state.findings.filter((f) => f.status === 'verified' && inRange(f.verified_at, previousFrom, from));

    return {
        period: { from: new Date(from).toISOString(), to: new Date(now).toISOString(), days, previous_from: new Date(previousFrom).toISOString() },
        vulnerabilities: {
            open_now: open.length,
            open_by_priority: countBy(open, (f) => f.priority ?? 'P4'),
            overdue_now: open.filter((f) => f.due_at && Date.parse(f.due_at) < now).length,
            new_in_period: newIn.length,
            new_in_previous: newPrev.length,
            new_p1_p2_in_period: newIn.filter((f) => f.priority === 'P1' || f.priority === 'P2').length,
            verified_in_period: verifiedIn.length,
            verified_in_previous: verifiedPrev.length,
        },
        scans: { in_period: scansIn.length, in_previous: scansPrev.length, by_status: countBy(scansIn, (s) => s.status) },
        assets: {
            active: activeAssets.length,
            by_criticality: countBy(activeAssets, (a) => a.criticality),
            open_critical_assets: new Set(open.filter((f) => f.scanner_severity === 'critical' && f.asset_id).map((f) => f.asset_id)).size,
        },
        alerts: {
            total: state.socAlerts.length,
            by_severity: countBy(state.socAlerts, (a) => a.severity),
            by_status: countBy(state.socAlerts, (a) => a.lifecycle),
            new_in_period: state.socAlerts.filter((a) => inRange(a.detected_at, from, now)).length,
            new_in_previous: state.socAlerts.filter((a) => inRange(a.detected_at, previousFrom, from)).length,
            automated_closures: state.socAlerts.filter((a) => a.lifecycle === 'auto_closed').length,
            escalated: state.socAlerts.filter((a) => a.lifecycle === 'escalated' || a.lifecycle === 'case_created').length,
        },
        cases: {
            opened_in_period: state.socCases.filter((c) => inRange(c.created_at, from, now)).length,
            opened_in_previous: state.socCases.filter((c) => inRange(c.created_at, previousFrom, from)).length,
            active: state.socCases.filter((c) => c.status !== 'resolved').length,
            critical_active: state.socCases.filter((c) => c.status !== 'resolved' && c.severity === 'critical').length,
            by_severity_opened: countBy(state.socCases.filter((c) => inRange(c.created_at, from, now)), (c) => c.severity),
            escalated: state.socCases.filter((c) => c.escalated).length,
            auto_closed: state.socCases.filter((c) => c.auto_closed).length,
            workload: countBy(state.socCases.filter((c) => c.status !== 'resolved'), (c) => c.assigned_to ?? 'Unassigned'),
        },
        health: [{ name: 'Shared simulation clock', status: 'ok', detail: 'Records and scans are read from the same persisted state.' }],
        limitations: [
            'Alert and case figures count the illustrative SOC records; automatic closures and escalations come from the SOC policy decisions.',
            'Counts cover the stored simulation records only; they are illustrative, not measurements of a live environment.',
        ],
        generated_at: new Date(now).toISOString(),
    };
}
