// Vulnerability report (GET /api/vms/report). Pure function of the shared simulation state and a
// clock value, so the route and the tests compute exactly the same figures. Nothing here is
// estimated: every number is a count, mean or share over stored records.
import type { FindingRecord, FindingStatus, SimState } from './types';

const DAY_MS = 86_400_000;
const CLOSED: FindingStatus[] = ['verified', 'risk_accepted', 'false_positive'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export interface VulnerabilityReport {
    period: { from: string; to: string; days: number };
    summary: {
        assets_assessed: number;
        critical_assets_exposed: number;
        open_findings: number;
        open_critical: number;
        remediation_progress_pct: number | null;
        patch_compliance_pct: number | null;
        overdue_remediation: number;
    };
    open_now: { total: number; by_priority: Record<string, number>; overdue: number };
    new_in_period: { total: number; by_priority: Record<string, number>; by_source: Record<string, number> };
    status_changes: Record<string, number>;
    time_to_remediate: Record<string, { verified: number; mean_hours: number | null; within_deadline: number }>;
    scans: Record<string, number>;
    attack_surface_changes: null;
    trend: { day: string; new: number; verified: number }[];
    top_open: { id: string; title: string; asset: string; priority: string; due_at: string | null; status: string }[];
    top_assets: { asset_id: string; value: string; criticality: string; exposure: string; open: number; open_critical: number }[];
    recurring: { reopened: { id: string; title: string; asset_value: string; times_reopened: number }[]; widespread: { rule_id: string; title: string; open_on_assets: number }[] };
    closure: { available: false; note: string };
    limitations: string[];
    sources: string[];
    generated_at: string;
}

function countBy<T>(items: T[], key: (t: T) => string | null | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of items) {
        const k = key(item);
        if (k) out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}

function priorityCounts(items: FindingRecord[]): Record<string, number> {
    const out: Record<string, number> = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
    for (const f of items) if (f.priority) out[f.priority] = (out[f.priority] ?? 0) + 1;
    return out;
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const pct = (num: number, den: number) => (den === 0 ? null : Math.round((num / den) * 1000) / 10);

export function buildVulnerabilityReport(state: SimState, days: number, now: number): VulnerabilityReport {
    const from = now - days * DAY_MS;
    const inPeriod = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= from && Date.parse(iso) <= now;
    const findings = state.findings;
    const open = findings.filter((f) => !CLOSED.includes(f.status));
    const overdue = open.filter((f) => f.due_at && Date.parse(f.due_at) < now);
    const newInPeriod = findings.filter((f) => inPeriod(f.first_seen));
    const verifiedInPeriod = findings.filter((f) => f.status === 'verified' && inPeriod(f.verified_at));
    const activeAssets = state.assets.filter((a) => a.status === 'active');
    const withPatch = findings.filter((f) => f.patch_available);
    const patchedVerified = withPatch.filter((f) => f.status === 'verified');
    const closedAll = findings.filter((f) => CLOSED.includes(f.status));

    const timeToRemediate: VulnerabilityReport['time_to_remediate'] = {};
    for (const p of PRIORITIES) {
        const rows = verifiedInPeriod.filter((f) => f.priority === p);
        const hours = rows.filter((f) => f.verified_at).map((f) => (Date.parse(f.verified_at as string) - Date.parse(f.first_seen)) / 3_600_000);
        timeToRemediate[p] = {
            verified: rows.length,
            mean_hours: mean(hours),
            within_deadline: rows.filter((f) => f.due_at && f.verified_at && Date.parse(f.verified_at) <= Date.parse(f.due_at)).length,
        };
    }

    const scansInPeriod = state.scans.filter((s) => inPeriod(s.requested_at));

    const trend: VulnerabilityReport['trend'] = [];
    for (let d = days - 1; d >= 0; d--) {
        const day = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
        trend.push({
            day,
            new: findings.filter((f) => f.first_seen.slice(0, 10) === day).length,
            verified: findings.filter((f) => f.verified_at && f.verified_at.slice(0, 10) === day).length,
        });
    }

    const topOpen = [...open]
        .sort((a, b) => PRIORITIES.indexOf((a.priority ?? 'P4') as typeof PRIORITIES[number]) - PRIORITIES.indexOf((b.priority ?? 'P4') as typeof PRIORITIES[number]) || (b.risk_score ?? 0) - (a.risk_score ?? 0))
        .filter((f) => f.priority === 'P1' || f.priority === 'P2')
        .slice(0, 10)
        .map((f) => ({ id: f.id, title: f.title, asset: f.asset_value, priority: f.priority ?? 'P4', due_at: f.due_at, status: f.status }));

    const topAssets = activeAssets
        .map((a) => {
            const mine = open.filter((f) => f.asset_id === a.id);
            return { asset_id: a.id, value: a.value, criticality: a.criticality, exposure: a.exposure, open: mine.length, open_critical: mine.filter((f) => f.scanner_severity === 'critical').length };
        })
        .filter((a) => a.open > 0)
        .sort((x, y) => y.open_critical - x.open_critical || y.open - x.open)
        .slice(0, 8);

    const widespreadMap = new Map<string, { rule_id: string; title: string; assets: Set<string> }>();
    for (const f of open) {
        const entry = widespreadMap.get(f.rule_id) ?? { rule_id: f.rule_id, title: f.title, assets: new Set<string>() };
        if (f.asset_id) entry.assets.add(f.asset_id);
        widespreadMap.set(f.rule_id, entry);
    }
    const widespread = [...widespreadMap.values()]
        .filter((e) => e.assets.size >= 3)
        .map((e) => ({ rule_id: e.rule_id, title: e.title, open_on_assets: e.assets.size }));

    return {
        period: { from: new Date(from).toISOString(), to: new Date(now).toISOString(), days },
        summary: {
            assets_assessed: activeAssets.length,
            critical_assets_exposed: new Set(open.filter((f) => f.scanner_severity === 'critical' && f.asset_id).map((f) => f.asset_id)).size,
            open_findings: open.length,
            open_critical: open.filter((f) => f.scanner_severity === 'critical').length,
            remediation_progress_pct: pct(closedAll.length, findings.length),
            patch_compliance_pct: pct(patchedVerified.length, withPatch.length),
            overdue_remediation: overdue.length,
        },
        open_now: { total: open.length, by_priority: priorityCounts(open), overdue: overdue.length },
        new_in_period: { total: newInPeriod.length, by_priority: priorityCounts(newInPeriod), by_source: countBy(newInPeriod, (f) => f.source_class) },
        status_changes: { verified: verifiedInPeriod.length },
        time_to_remediate: timeToRemediate,
        scans: countBy(scansInPeriod, (s) => s.status),
        attack_surface_changes: null,
        trend,
        top_open: topOpen,
        top_assets: topAssets,
        recurring: { reopened: [], widespread },
        closure: { available: false, note: 'Verification evidence (rescan result versus a claimed fix) is not recorded separately in this build; a finding counted as verified was set to verified in the record.' },
        limitations: [
            'Attack-surface change history is not recorded in this build, so no surface changes are reported.',
            'Status history is not stored per change; only the verification date is counted.',
            'Reopen history is not recorded, so no finding is reported as reopened.',
            'All findings and assets are illustrative records from the simulation, not measurements of a live environment.',
        ],
        sources: ['Simulation findings and their status records', 'Simulation assets (inventory)', 'Simulation scan records'],
        generated_at: new Date(now).toISOString(),
    };
}
