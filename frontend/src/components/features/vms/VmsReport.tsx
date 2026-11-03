'use client';

// Vulnerability report: what happened in vulnerability management over a stated period, counted
// from the shared simulation records, with the sources used and what the report cannot see.
// Printable; exports the summary, trend, open P1/P2 and top assets as CSV.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileBarChart, Printer, Download } from 'lucide-react';
import { loadJson } from '@/lib/alerts';
import { fmtWat } from '@/lib/vms';
import { ExportButton } from '@/components/shared/ExportButton';
import { PageHeader, Segmented, btn } from './kit';

interface Report {
    period: { from: string; to: string; days: number };
    summary?: {
        assets_assessed: number; critical_assets_exposed: number; open_findings: number; open_critical: number;
        remediation_progress_pct: number | null; patch_compliance_pct: number | null; overdue_remediation: number;
    };
    open_now?: { total: number; by_priority: Record<string, number>; overdue: number };
    new_in_period?: { total: number; by_priority: Record<string, number>; by_source: Record<string, number> };
    status_changes?: Record<string, number>;
    time_to_remediate?: Record<string, { verified: number; mean_hours: number | null; within_deadline: number }>;
    scans?: Record<string, number>;
    attack_surface_changes?: Record<string, number> | null;
    trend?: { day: string; new: number; verified: number }[];
    top_open?: { id: string; title: string; asset: string; priority: string; due_at: string | null; status: string }[];
    top_assets?: { asset_id: string; value: string; criticality: string; exposure: string; open: number; open_critical: number }[];
    recurring?: { reopened: { id: string; title: string; asset_value: string; times_reopened: number }[]; widespread: { rule_id: string; title: string; open_on_assets: number }[] };
    closure?: { available: false; note: string } | { available: true; [k: string]: unknown };
    limitations?: string[];
    sources?: string[];
}

const pairs = (o: Record<string, number> | null | undefined) => {
    const entries = Object.entries(o ?? {}).filter(([, v]) => v > 0);
    return entries.length ? entries.map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ') : 'none';
};
const pct = (v: number | null | undefined) => (v === null || v === undefined ? 'no data' : `${v}%`);

function csvCell(v: unknown): string {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(data: Report, days: number) {
    const lines: string[][] = [
        ['Section', 'Item', 'Value'],
        ['Period', 'Days', String(days)],
        ['Period', 'From', data.period.from],
        ['Period', 'To', data.period.to],
    ];
    if (data.summary) {
        const s = data.summary;
        lines.push(['Summary', 'Assets assessed', String(s.assets_assessed)], ['Summary', 'Critical assets exposed', String(s.critical_assets_exposed)],
            ['Summary', 'Open findings', String(s.open_findings)], ['Summary', 'Open critical', String(s.open_critical)],
            ['Summary', 'Remediation progress %', s.remediation_progress_pct === null ? '' : String(s.remediation_progress_pct)],
            ['Summary', 'Patch compliance %', s.patch_compliance_pct === null ? '' : String(s.patch_compliance_pct)],
            ['Summary', 'Overdue remediation', String(s.overdue_remediation)]);
    }
    for (const t of data.trend ?? []) lines.push(['Trend', t.day, `new ${t.new}; verified ${t.verified}`]);
    for (const f of data.top_open ?? []) lines.push(['Open P1/P2', `${f.priority} ${f.title}`, `${f.asset} · ${f.status} · due ${f.due_at ?? 'not set'}`]);
    for (const a of data.top_assets ?? []) lines.push(['Top assets', a.value, `open ${a.open}; critical ${a.open_critical}; criticality ${a.criticality}; exposure ${a.exposure}`]);
    const csv = lines.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vms-report-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/** endpoint: the report API (the client portal reads /api/client/vms/report); exports: the staff CSV links. */
export function VmsReport({ endpoint = '/api/vms/report', exports = true, findingsPath = '/admin/vms/findings' }: { endpoint?: string; exports?: boolean; findingsPath?: string } = {}) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Report | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        void loadJson<Report>(`${endpoint}?days=${days}`).then((r) => {
            if (!active) return;
            setData(r.ok ? r.data : null);
            setError(r.ok ? null : r.error);
        });
        return () => { active = false; };
    }, [days, endpoint]);

    const section = 'bg-card border border-border rounded-2xl p-4 text-xs space-y-1';
    const s = data?.summary;
    const tiles: [string, string | number | undefined][] = s ? [
        ['Assets assessed', s.assets_assessed],
        ['Critical assets exposed', s.critical_assets_exposed],
        ['Open vulnerabilities', s.open_findings],
        ['Open critical', s.open_critical],
        ['Remediation progress', pct(s.remediation_progress_pct)],
        ['Patch compliance', pct(s.patch_compliance_pct)],
        ['Overdue remediation', s.overdue_remediation],
    ] : [];

    return (
        <div className="space-y-4">
            <PageHeader icon={FileBarChart} title="Vulnerability Report" description="What happened in vulnerability management over the period, counted from the stored records, with the sources used and what the report cannot see."
                actions={<div className="flex flex-wrap items-center gap-2 print:hidden">
                    <Segmented label="Period" value={String(days) as '7' | '30' | '90'} onChange={(v) => setDays(Number(v))} options={[['7', '7 days'], ['30', '30 days'], ['90', '90 days']]} />
                    <ExportButton elementId="vms-report" filename={`vms-report-${days}d-${new Date().toISOString().slice(0, 10)}`} title={`Vulnerability report — last ${days} days`} />
                    {data && <button onClick={() => downloadCsv(data, days)} className={btn('secondary', 'md')}><Download className="w-3.5 h-3.5" aria-hidden /> Export CSV</button>}
                    <button onClick={() => window.print()} className={btn('secondary', 'md')}><Printer className="w-3.5 h-3.5" aria-hidden /> Print</button>
                </div>} />
            {exports && <div className="bg-card border border-border rounded-2xl p-4 text-xs print:hidden">
                <p className="font-bold text-foreground mb-2">Data exports (CSV)</p>
                <p className="text-foreground-muted mb-2">Each list exports exactly the rows its filters show.</p>
                <div className="flex flex-wrap gap-2">
                    {[['/admin/vms/findings', 'Findings'], ['/admin/vms/assets', 'Assets'], ['/admin/vms/remediation?view=table', 'Remediation tasks'], ['/admin/vms/risk', 'Risk queue'], ['/admin/vms/scans/history', 'Scan history'], ['/admin/vms/audit', 'Audit trail']].map(([h, l]) => <Link key={h} href={h} className={btn('secondary')}>{l}</Link>)}
                </div>
            </div>}
            {error && <p role="alert" className="text-xs text-red font-semibold">Could not load the report: {error}</p>}
            <div id="vms-report" className="space-y-4">
            {data && (
                <>
                    <p className="text-xs text-foreground-muted">Period: {fmtWat(data.period.from)} to {fmtWat(data.period.to)} ({data.period.days} days). Counted from the stored records when this page was opened.</p>
                    {tiles.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {tiles.map(([label, value]) => (
                                <div key={label} className="bg-card border border-border rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{label}</p>
                                    <p className="text-xl font-black text-foreground mt-1">{value ?? '—'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={section}>
                        <h2 className="text-sm font-black text-foreground">Position now</h2>
                        <p>{data.open_now?.total ?? 0} open findings ({pairs(data.open_now?.by_priority)}); {data.open_now?.overdue ?? 0} past their deadline.</p>
                    </div>
                    <div className={section}>
                        <h2 className="text-sm font-black text-foreground">In the period</h2>
                        <p>New findings: {data.new_in_period?.total ?? 0} ({pairs(data.new_in_period?.by_priority)}); by source: {pairs(data.new_in_period?.by_source)}.</p>
                        <p>Verified fixes: {pairs(data.status_changes)}.</p>
                        <p>Scans: {pairs(data.scans)}.</p>
                        <p>Attack surface: {data.attack_surface_changes === null || data.attack_surface_changes === undefined ? 'change history not recorded in this build' : pairs(data.attack_surface_changes)}.</p>
                    </div>
                    {data.trend && data.trend.length > 0 && (
                        <div className={section}>
                            <h2 className="text-sm font-black text-foreground">Vulnerability trend (per day)</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                    <thead><tr className="text-left text-foreground-muted"><th className="py-1 pr-3">Day</th><th className="py-1 pr-3">New findings</th><th className="py-1">Verified fixed</th></tr></thead>
                                    <tbody>{data.trend.map((t) => <tr key={t.day} className="border-t border-border"><td className="py-1 pr-3 font-mono">{t.day}</td><td className="py-1 pr-3">{t.new}</td><td className="py-1">{t.verified}</td></tr>)}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {data.time_to_remediate && (
                        <div className={section}>
                            <h2 className="text-sm font-black text-foreground">Time to verified fix</h2>
                            {Object.entries(data.time_to_remediate).map(([p, t]) => <p key={p}>{p}: {t.verified} verified{t.mean_hours !== null ? `, mean ${t.mean_hours} h, ${t.within_deadline} within deadline` : ''}</p>)}
                        </div>
                    )}
                    {data.closure && (
                        <div className={section}>
                            <h2 className="text-sm font-black text-foreground">Verified closure</h2>
                            {!data.closure.available ? <p className="text-foreground-muted">{data.closure.note}</p> : <p>Verification details are available.</p>}
                        </div>
                    )}
                    <div className={section}>
                        <h2 className="text-sm font-black text-foreground">Top affected assets</h2>
                        {!data.top_assets || data.top_assets.length === 0 ? <p className="text-foreground-muted">No asset has open findings.</p> : data.top_assets.map((a) => (
                            <p key={a.asset_id}><Link href={`/admin/vms/assets/${a.asset_id}`} className="font-mono text-blue">{a.value}</Link> · criticality {a.criticality} · exposure {a.exposure} · {a.open} open ({a.open_critical} critical)</p>
                        ))}
                    </div>
                    <div className={section}>
                        <h2 className="text-sm font-black text-foreground">Open P1 / P2</h2>
                        {!data.top_open || data.top_open.length === 0 ? <p className="text-foreground-muted">None.</p> : data.top_open.map((f) => <p key={f.id}><span className="font-bold">{f.priority}</span> <Link href={`${findingsPath}?id=${f.id}`} className="text-blue">{f.title}</Link> · {f.asset} · {f.status} · due {f.due_at ? fmtWat(f.due_at) : 'not set'}</p>)}
                    </div>
                    <div className={section}>
                        <h2 className="text-sm font-black text-foreground">Recurring</h2>
                        <p>Reopened after a fix: {data.recurring?.reopened.length ? data.recurring.reopened.map((f) => `${f.title} on ${f.asset_value} (${f.times_reopened}×)`).join('; ') : 'none recorded'}.</p>
                        <p>Open on 3+ assets: {data.recurring?.widespread.length ? data.recurring.widespread.map((r) => `${r.title} (${r.open_on_assets})`).join('; ') : 'none'}.</p>
                    </div>
                    <div className={`${section} border-amber/30`}>
                        <h2 className="text-sm font-black text-foreground">Limitations</h2>
                        {(data.limitations ?? []).map((l) => <p key={l}>• {l}</p>)}
                        <p className="text-foreground-muted">Sources: {(data.sources ?? []).join(', ') || '—'}.</p>
                    </div>
                </>
            )}
            </div>
        </div>
    );
}
