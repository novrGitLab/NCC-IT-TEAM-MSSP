'use client';

// Executive Dashboard — reuses the same shared simulation data every other screen reads
// (GET /api/vms/dashboard, /api/posture/summary, /api/collectors, /api/cases), the existing VMS
// chart/table/kit components, and the existing PDF export helper. Every figure here is counted
// from those same stored records; nothing is estimated or fabricated independently of them.

import Link from 'next/link';
import { ShieldCheck, Server, Bug, Wrench, Siren, Radio, ArrowRight } from 'lucide-react';
import { exportPageAsPDF } from '@/lib/exportPDF';
import { PageHeader, KpiCard, PriorityBadge, SeverityBadge, RiskScore, btn, relTime } from './vms/kit';
import { Card, SectionTitle, StatusPill, type Tone } from './vms/ui';
import { ChartCard, TimeChart, Donut, BarList, Legend, type Series } from './vms/charts';
import { DataTable, type Column } from './vms/table';
import { useVmsData } from './vms/data';

interface Dashboard {
    kpis: { total_assets: number; critical_open: number; critical_exposures: number; overdue_tasks: number; remediation_rate: number | null; risk_mean: number | null };
    charts: {
        severity: Record<string, number>; assets_by_criticality: Record<string, number>; tasks: Record<string, number>;
        risk: { day: string; risk_mean: number; risk_max: number | null }[];
        exposure: { day: string; critical_exposures: number | null; internet_open: number; kev_open: number }[];
    };
    lists: {
        highest_risk_assets: { asset_id: string; value: string; open: number; by_severity: Record<string, number>; max_risk: number; exposure: string | null; criticality: string | null; asset_type: string | null }[];
        overdue_tasks: { id: string; title: string; owner: string | null; due_at: string; status: string; finding: { id: string; title: string; asset_value: string; priority: string | null } | null }[];
    };
}
interface PostureSummary { total_assets: number; by_posture: Record<'secure' | 'monitored' | 'at_risk' | 'critical', number> }
interface CollectorSummary { collectors: { id: string; status: string }[] }
interface CaseSummary { summary?: { active: number; critical: number } }
type HighestRiskAsset = Dashboard['lists']['highest_risk_assets'][number];
type OverdueTask = Dashboard['lists']['overdue_tasks'][number];

const SEV_SERIES: Series[] = [
    { key: 'critical', label: 'Critical', token: '--vz-sev-critical' }, { key: 'high', label: 'High', token: '--vz-sev-high' },
    { key: 'medium', label: 'Medium', token: '--vz-sev-medium' }, { key: 'low', label: 'Low', token: '--vz-sev-low' }, { key: 'info', label: 'Informational', token: '--vz-sev-info' },
];
const RISK_SERIES: Series[] = [{ key: 'risk_mean', label: 'Mean risk score', token: '--vz-prog-4' }];
const EXPOSURE_SERIES: Series[] = [{ key: 'critical_exposures', label: 'Critical exposures', token: '--vz-critical' }, { key: 'internet_open', label: 'Internet-facing open', token: '--vz-warning' }];
const CRIT = ['critical', 'high', 'medium', 'low'] as const;
const POSTURE_LABEL: Record<string, string> = { secure: 'Secure', monitored: 'Monitored', at_risk: 'At risk', critical: 'Critical' };
const POSTURE_TOKEN: Record<string, Series['token']> = { secure: '--vz-good', monitored: '--vz-neutral', at_risk: '--vz-warning', critical: '--vz-critical' };

export function ExecutiveReport() {
    const { load, data: d, at } = useVmsData<Dashboard>('/api/vms/dashboard?days=30');
    const posture = useVmsData<PostureSummary>('/api/posture/summary');
    const collectors = useVmsData<CollectorSummary>('/api/collectors');
    const cases = useVmsData<CaseSummary>('/api/cases');
    const now = at ?? 0;
    const loading = load.state === 'loading' && !d;

    const operationalCollectors = collectors.data?.collectors.filter((c) => c.status === 'operational').length ?? 0;
    const totalCollectors = collectors.data?.collectors.length ?? 0;
    const atRiskOrCritical = posture.data ? posture.data.by_posture.at_risk + posture.data.by_posture.critical : null;
    const postureScore = posture.data && posture.data.total_assets > 0
        ? Math.round(((posture.data.by_posture.secure + posture.data.by_posture.monitored) / posture.data.total_assets) * 100)
        : null;

    const criticalAssetCols: Column<HighestRiskAsset>[] = [
        { key: 'value', header: 'Asset', className: 'min-w-[160px]', render: (a) => <Link href={`/admin/vms/assets/${a.asset_id}`} className="font-mono font-semibold text-purple hover:underline">{a.value}</Link> },
        { key: 'type', header: 'Type', render: (a) => <span className="text-[11px] capitalize">{a.asset_type ?? '—'}</span> },
        { key: 'criticality', header: 'Criticality', sort: (a) => CRIT.indexOf((a.criticality ?? 'low') as typeof CRIT[number]), render: (a) => <span className="text-[11px] font-semibold capitalize">{a.criticality ?? '—'}</span> },
        { key: 'exposure', header: 'Exposure', render: (a) => <span className="text-[11px] capitalize">{a.exposure ?? '—'}</span> },
        { key: 'vulns', header: 'Vulnerabilities', sort: (a) => a.open, render: (a) => <span className="tabular-nums font-semibold">{a.open}</span> },
        { key: 'risk', header: 'Risk', sort: (a) => a.max_risk, render: (a) => <RiskScore score={a.max_risk} /> },
        { key: 'action', header: '', render: (a) => <Link href={`/admin/vms/assets/${a.asset_id}`} className={btn('ghost')}>View <ArrowRight className="w-3 h-3" aria-hidden /></Link> },
    ];
    const remediationCols: Column<OverdueTask>[] = [
        { key: 'title', header: 'Vulnerability', className: 'min-w-[200px]', render: (t) => <span className="font-semibold text-foreground">{t.finding?.title ?? t.title}</span> },
        { key: 'asset', header: 'Affected Asset', render: (t) => <span className="font-mono text-[11px]">{t.finding?.asset_value ?? '—'}</span> },
        { key: 'risk', header: 'Risk', render: (t) => <PriorityBadge priority={t.finding?.priority ?? null} /> },
        { key: 'owner', header: 'Owner', render: (t) => <span className="text-[11px] text-foreground-muted">{t.owner ?? 'Unassigned'}</span> },
        { key: 'due', header: 'Deadline', sort: (t) => t.due_at, render: (t) => <span className="text-[11px] text-red font-semibold">{relTime(t.due_at, now)}</span> },
        { key: 'status', header: 'Status', render: (t) => <StatusPill tone="warning" label={t.status.replace(/_/g, ' ')} /> },
    ];

    return (
        <div id="executive-report" className="space-y-6">
            <PageHeader icon={ShieldCheck} title="Executive Dashboard"
                description="Organisational security posture — every figure below is counted from the same records Vulnerability Management, Security Operations and Collector Management read, for the last 30 days."
                actions={<button onClick={() => exportPageAsPDF('executive-report', 'executive-dashboard', 'Executive Dashboard')} className={btn('secondary', 'md')}>Export Report</button>} />

            {load.state === 'error' ? <p className="text-xs text-red">Could not load executive data.</p> : (
                <>
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KpiCard label="Security posture score" value={postureScore} suffix={postureScore !== null ? '%' : undefined} reason="Loading" icon={ShieldCheck} tone={postureScore !== null ? (postureScore >= 80 ? 'good' : postureScore >= 50 ? 'warning' : 'critical') : undefined} sub="Share of assets secure or monitored" />
                        <KpiCard label="Total monitored assets" value={d?.kpis.total_assets} reason="Loading" icon={Server} href="/admin/vms/assets" />
                        <KpiCard label="Critical assets requiring attention" value={atRiskOrCritical} reason="Loading" tone={atRiskOrCritical ? 'critical' : 'good'} href="/admin/vms/assets" sub="At-risk or critical posture" />
                        <KpiCard label="Open critical vulnerabilities" value={d?.kpis.critical_open} reason="Loading" icon={Bug} tone={d && d.kpis.critical_open > 0 ? 'critical' : 'good'} href="/admin/vms/findings?severity=critical" />
                        <KpiCard label="Patch compliance" value={d?.kpis.remediation_rate !== null && d?.kpis.remediation_rate !== undefined ? Math.round(d.kpis.remediation_rate * 100) : null} suffix="%" reason="No findings verified yet" icon={Wrench} href="/admin/vms/remediation" />
                        <KpiCard label="Overdue remediation" value={d?.kpis.overdue_tasks} reason="Loading" tone={d && d.kpis.overdue_tasks > 0 ? 'warning' : 'good'} href="/admin/vms/remediation?view=table&overdue=1" />
                        <KpiCard label="Active incidents" value={cases.data?.summary?.active} reason="Loading" icon={Siren} href="/admin/secops/cases" sub={cases.data?.summary ? `${cases.data.summary.critical} critical` : undefined} />
                        <KpiCard label="Collector coverage" text={totalCollectors ? `${operationalCollectors} / ${totalCollectors}` : undefined} value={totalCollectors ? undefined : null} reason="No collectors yet" icon={Radio} href="/admin/onboarding/collectors" tone={totalCollectors ? (operationalCollectors === totalCollectors ? 'good' : 'warning') : undefined} sub="Operational collectors" />
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <ChartCard title="Vulnerability severity distribution" loading={loading}>
                            {d && <Donut label="Open findings by severity" centerLabel="open" slices={SEV_SERIES.map((s) => ({ key: s.key, label: s.label, token: s.token, value: d.charts.severity[s.key] ?? 0, href: `/admin/vms/findings?severity=${s.key}` }))} />}
                        </ChartCard>
                        <ChartCard title="Security posture" loading={posture.load.state === 'loading' && !posture.data}>
                            {posture.data && <Donut label="Assets by posture" centerLabel="assets" slices={(['secure', 'monitored', 'at_risk', 'critical'] as const).map((k) => ({ key: k, label: POSTURE_LABEL[k], token: POSTURE_TOKEN[k], value: posture.data!.by_posture[k] ?? 0 }))} />}
                        </ChartCard>
                        <ChartCard title="Asset criticality breakdown" loading={loading}>
                            {d && <BarList label="Assets by criticality" items={CRIT.map((c, i) => ({ key: c, label: c[0].toUpperCase() + c.slice(1), value: d.charts.assets_by_criticality[c] ?? 0, token: (['--vz-prog-4', '--vz-prog-3', '--vz-prog-2', '--vz-prog-1'] as const)[i], href: `/admin/vms/assets?criticality=${c}` }))} />}
                        </ChartCard>
                        <ChartCard className="xl:col-span-2" title="Security posture trend" hint="Daily snapshot of the mean open-finding risk score." loading={loading} empty={d && d.charts.risk.length === 0 ? { title: 'Not enough history yet' } : null}>
                            {d && <><TimeChart kind="line" label="Risk score over time" data={d.charts.risk} series={RISK_SERIES} yMax={100} stacked={false} /><Legend series={RISK_SERIES} /></>}
                        </ChartCard>
                        <ChartCard title="Remediation progress" loading={loading}>
                            {d && <BarList label="Remediation tasks by state" items={[['todo', 'To do', '--vz-prog-1'], ['doing', 'In progress', '--vz-prog-3'], ['done', 'Done', '--vz-good'], ['cancelled', 'Cancelled', '--vz-neutral']].map(([key, label, token]) => ({ key, label, value: d.charts.tasks[key] ?? 0, token: token as Series['token'], href: '/admin/vms/remediation?view=table' }))} />}
                        </ChartCard>
                        <ChartCard className="xl:col-span-3" title="Critical exposure trend" hint="Daily snapshots of open findings that matter most from outside." loading={loading} empty={d && d.charts.exposure.length < 2 ? { title: 'Not enough history yet' } : null}>
                            {d && <><TimeChart kind="line" label="Exposure trend" data={d.charts.exposure} series={EXPOSURE_SERIES} stacked={false} height={200} /><Legend series={EXPOSURE_SERIES} /></>}
                        </ChartCard>
                    </section>

                    <Card>
                        <SectionTitle title="Top 5 Critical Assets" hint="Highest open risk, ranked" action={<Link href="/admin/vms/assets" className={btn('ghost')}>All assets</Link>} />
                        <DataTable caption="Top 5 critical assets" rows={d?.lists.highest_risk_assets.slice(0, 5) ?? null} columns={criticalAssetCols} rowKey={(a) => a.asset_id} initialSort={{ key: 'risk', dir: 'desc' }} empty="No asset has open findings" />
                    </Card>

                    <Card>
                        <SectionTitle title="Priority Remediation" hint="Overdue, ranked by deadline" action={<Link href="/admin/vms/remediation?view=table&overdue=1" className={btn('ghost')}>All remediation</Link>} />
                        <DataTable caption="Priority remediation" rows={d?.lists.overdue_tasks.slice(0, 5) ?? null} columns={remediationCols} rowKey={(t) => t.id} initialSort={{ key: 'due', dir: 'asc' }} empty="Nothing overdue" />
                    </Card>

                    <Card>
                        <SectionTitle title="Priority recommendations" />
                        <ul className="space-y-2 text-xs text-foreground">
                            {d && d.kpis.critical_open > 0 && <li>• {d.kpis.critical_open} open critical vulnerability{d.kpis.critical_open === 1 ? '' : 'ies'} — prioritise remediation on business-critical assets first.</li>}
                            {d && d.kpis.overdue_tasks > 0 && <li>• {d.kpis.overdue_tasks} remediation task{d.kpis.overdue_tasks === 1 ? '' : 's'} overdue — review ownership and deadlines in Remediation.</li>}
                            {totalCollectors > 0 && operationalCollectors < totalCollectors && <li>• {totalCollectors - operationalCollectors} collector{totalCollectors - operationalCollectors === 1 ? '' : 's'} not yet operational — check Collector Management for status.</li>}
                            {cases.data?.summary && cases.data.summary.critical > 0 && <li>• {cases.data.summary.critical} critical incident{cases.data.summary.critical === 1 ? '' : 's'} open in Security Operations.</li>}
                            {d && d.kpis.critical_open === 0 && d.kpis.overdue_tasks === 0 && (!cases.data?.summary || cases.data.summary.critical === 0) && <li>No critical items require immediate executive attention.</li>}
                        </ul>
                    </Card>
                </>
            )}
        </div>
    );
}
