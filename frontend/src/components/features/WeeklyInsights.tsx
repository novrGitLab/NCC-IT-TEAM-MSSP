'use client';

// SOC insights (/admin/secops/insights). Counts come from the shared engine records through
// GET /api/insights/weekly. Alert and incident trends are shown as not available until SOC alert
// and case records are stored in the shared engine.

import { useEffect, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { loadJson } from '@/lib/alerts';
import { fmtWat } from '@/lib/vms';

interface Facts {
    period: { from: string; to: string; days: number; previous_from: string };
    vulnerabilities: {
        open_now: number; open_by_priority: Record<string, number>; overdue_now: number;
        new_in_period: number; new_in_previous: number; new_p1_p2_in_period: number;
        verified_in_period: number; verified_in_previous: number;
    };
    scans: { in_period: number; in_previous: number; by_status: Record<string, number> };
    assets: { active: number; by_criticality: Record<string, number>; open_critical_assets: number };
    alerts: { total: number; by_severity: Record<string, number>; by_status: Record<string, number>; new_in_period: number; new_in_previous: number; automated_closures: number; escalated: number };
    cases: { opened_in_period: number; opened_in_previous: number; active: number; critical_active: number; by_severity_opened: Record<string, number>; escalated: number; auto_closed: number; workload: Record<string, number> };
    health: { name: string; status: string; detail: string }[];
    limitations: string[];
}

const pairs = (o: Record<string, number>) => {
    const entries = Object.entries(o).filter(([, v]) => v > 0);
    return entries.length ? entries.map(([k, v]) => `${k} ${v}`).join(' · ') : 'none';
};
const change = (now: number, before: number) => {
    if (before === 0) return now === 0 ? 'no change' : 'no previous-period records';
    const d = Math.round(((now - before) / before) * 100);
    return `${d >= 0 ? '+' : ''}${d}% versus the previous period`;
};

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-black text-foreground mt-1">{value}</p>
            {sub && <p className="text-[10px] text-foreground-muted mt-0.5">{sub}</p>}
        </div>
    );
}

export function WeeklyInsights() {
    const [period, setPeriod] = useState<7 | 30>(7);
    const [data, setData] = useState<Facts | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        void loadJson<Facts>(`/api/insights/weekly?days=${period}`).then((r) => {
            if (!active) return;
            setData(r.ok ? r.data : null);
            setError(r.ok ? null : r.error);
        });
        return () => { active = false; };
    }, [period]);

    const v = data?.vulnerabilities;
    const s = data?.scans;
    const sec = 'bg-card border border-border rounded-xl p-4 text-xs space-y-1';
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                    <h1 className="text-lg font-black text-foreground flex items-center gap-2"><CalendarRange className="w-5 h-5" aria-hidden /> SOC Insights</h1>
                    <p className="text-xs text-foreground-muted">Counted from the shared records for the period, compared with the period before.</p>
                </div>
                <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
                    {([7, 30] as const).map((p) => (
                        <button key={p} onClick={() => setPeriod(p)} className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${period === p ? 'bg-blue text-white' : 'text-foreground-muted'}`}>Last {p} days</button>
                    ))}
                </div>
            </div>

            {error && <p role="alert" className="text-xs text-red font-semibold">Could not load insights: {error}</p>}
            {!data && !error && <p className="text-xs text-foreground-muted">Loading insights…</p>}

            {data && v && s && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Tile label="Open vulnerabilities" value={v.open_now} sub={`${v.overdue_now} past deadline`} />
                        <Tile label="New findings" value={v.new_in_period} sub={change(v.new_in_period, v.new_in_previous)} />
                        <Tile label="New P1 / P2" value={v.new_p1_p2_in_period} sub="in the period" />
                        <Tile label="Verified fixes" value={v.verified_in_period} sub={change(v.verified_in_period, v.verified_in_previous)} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className={sec}>
                            <h2 className="text-sm font-black text-foreground">Vulnerability severity by priority</h2>
                            <p>{pairs(v.open_by_priority)}</p>
                        </div>
                        <div className={sec}>
                            <h2 className="text-sm font-black text-foreground">Asset criticality</h2>
                            <p>{data.assets.active} active assets: {pairs(data.assets.by_criticality)}.</p>
                            <p>{data.assets.open_critical_assets} asset(s) with an open critical finding.</p>
                        </div>
                        <div className={sec}>
                            <h2 className="text-sm font-black text-foreground">Scan activity</h2>
                            <p>{s.in_period} scan(s) in the period ({change(s.in_period, s.in_previous)}).</p>
                            <p>Status: {pairs(s.by_status)}.</p>
                        </div>
                        <div className={sec}>
                            <h2 className="text-sm font-black text-foreground">Alerts</h2>
                            <p>{data.alerts.new_in_period} new in the period ({change(data.alerts.new_in_period, data.alerts.new_in_previous)}); {data.alerts.total} in total.</p>
                            <p>By severity: {pairs(data.alerts.by_severity)}.</p>
                            <p>Automated closures: {data.alerts.automated_closures}. Escalated: {data.alerts.escalated}.</p>
                        </div>
                        <div className={sec}>
                            <h2 className="text-sm font-black text-foreground">Cases and analyst workload</h2>
                            <p>{data.cases.opened_in_period} opened in the period ({change(data.cases.opened_in_period, data.cases.opened_in_previous)}); {data.cases.active} active, {data.cases.critical_active} critical.</p>
                            <p>Escalated: {data.cases.escalated}. Closed by policy: {data.cases.auto_closed}.</p>
                            <p>Active cases by assignee: {pairs(data.cases.workload)}.</p>
                        </div>
                    </div>
                    <div className={sec}>
                        <h2 className="text-sm font-black text-foreground">Platform health</h2>
                        {data.health.map((h) => <p key={h.name}>{h.name}: {h.status} — {h.detail}</p>)}
                    </div>
                    <div className={`${sec} border-amber/30`}>
                        <h2 className="text-sm font-black text-foreground">Limitations</h2>
                        {data.limitations.map((l) => <p key={l}>• {l}</p>)}
                        <p className="text-foreground-muted">Period: {fmtWat(data.period.from)} to {fmtWat(data.period.to)}.</p>
                    </div>
                </>
            )}
        </div>
    );
}
