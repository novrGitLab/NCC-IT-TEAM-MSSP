'use client';

// SOC overview. Every figure is read from the shared SOC records through the SOC routes (alerts,
// cases, approvals, events). Nothing here is computed separately from those records.

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Siren, ShieldCheck, Clock, ArrowUpRight, ListChecks, Radio } from 'lucide-react';
import { KpiCard, btn } from './vms/kit';
import { Card, SectionTitle } from './vms/ui';
import { BarList, type BarItem } from './vms/charts';
import { useVmsData } from './vms/data';
import { apiFetch, apiUrl } from '@/lib/api';
import { getAdminUser } from '@/lib/admin-auth';
import { fmtWat } from '@/lib/vms';

interface CaseRow { severity: string; status: string; assigned_to: string | null }
interface CaseList { cases: CaseRow[]; summary: { open: number; investigating: number; contained: number; active: number; critical: number; resolvedToday: number } }
interface AlertStats { total: number; by_severity: Record<string, number>; by_status: Record<string, number>; automated_closures: number; escalated: number }
interface ApprovalList { approvals: { status: string }[]; total: number }
interface SocEvent { id: string; at: string; actor: string; action: string; details: Record<string, unknown> | null }
interface EventList { events: SocEvent[] }
interface Dashboard { lists: { highest_risk_assets: { asset_id: string; value: string; open: number; max_risk: number; criticality: string | null }[] } }

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
const SEVERITY_TOKEN: Record<string, string> = { critical: '--vz-sev-critical', high: '--vz-sev-high', medium: '--vz-sev-medium', low: '--vz-sev-low', info: '--vz-sev-info' };

function describe(e: SocEvent): string {
    const d = (e.details ?? {}) as Record<string, unknown>;
    if (e.action === 'soc_policy.decision') return `${String(d.alert_id ?? '')}: ${String(d.reason ?? '')}`;
    if (e.action === 'soc_policy.approval_requested') return `Approval requested: ${String(d.action ?? '')} (not executed)`;
    if (e.action === 'clock.advanced') return `Clock advanced ${String(d.minutes ?? '')} min; policy changes ${String(d.policy_changes ?? 0)}`;
    if (e.action.startsWith('approval.')) return `${e.action.replace('approval.', 'Approval ')} ${String(d.approval_id ?? '')}`;
    return e.action.replace(/[._]/g, ' ');
}

function AdvanceTime({ onDone }: { onDone: () => void }) {
    const [minutes, setMinutes] = useState(30);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    async function advance() {
        setBusy(true);
        setMsg(null);
        const r = await apiFetch(apiUrl('/api/sim/advance'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes }) });
        const d = await r.json().catch(() => null);
        setBusy(false);
        if (!r.ok) { setMsg(d?.error ?? `Could not advance time (HTTP ${r.status}).`); return; }
        setMsg(`Clock is now ${fmtWat(d.now)}. ${d.policy_changes} alert(s) changed by the policy.`);
        onDone();
    }
    return (
        <Card>
            <SectionTitle title="Advance simulation time" hint="Administrator control for this illustrative environment. Moves the shared clock forward and runs the SOC policy. No real time passes and no response action is executed." />
            <div className="flex items-center gap-2 flex-wrap text-xs">
                <label className="flex items-center gap-2">
                    <span className="text-foreground-muted">Advance by</span>
                    <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="border border-border rounded-lg px-2 py-1.5 bg-card">
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                        <option value={120}>2 hours</option>
                    </select>
                </label>
                <button disabled={busy} onClick={() => void advance()} className={btn('primary', 'md')}><Clock className="w-3.5 h-3.5" aria-hidden /> {busy ? 'Advancing…' : 'Advance Simulation Time'}</button>
                {msg && <span role="status" className="text-foreground-muted">{msg}</span>}
            </div>
        </Card>
    );
}

export function SecOpsOverview() {
    const admin = getAdminUser();
    const alerts = useVmsData<AlertStats>('/api/alerts/stats');
    const cases = useVmsData<CaseList>('/api/cases');
    const approvals = useVmsData<ApprovalList>('/api/approvals?status=pending');
    const events = useVmsData<EventList>('/api/soc/events?limit=12');
    const dashboard = useVmsData<Dashboard>('/api/vms/dashboard?days=7');

    const reloadAll = () => { alerts.reload(); cases.reload(); approvals.reload(); events.reload(); };
    const s = alerts.data;
    const c = cases.data?.summary;
    const severityBars: BarItem[] = s ? SEVERITY_ORDER.map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), value: s.by_severity[k] ?? 0, token: SEVERITY_TOKEN[k] as BarItem['token'], href: `/admin/secops/alerts?severity=${k}` })) : [];

    const workload: BarItem[] = cases.data
        ? Object.entries(cases.data.cases.filter((x) => x.status === 'open' || x.status === 'investigating' || x.status === 'contained').reduce<Record<string, number>>((acc, x) => {
            const key = x.assigned_to || 'Unassigned';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {})).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ key: label, label, value, token: label === 'Unassigned' ? '--vz-neutral' : '--vz-prog-3' }))
        : [];

    return (
        <div className="space-y-4">
            <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard label="Active alerts" value={s ? (s.by_status.new ?? 0) + (s.by_status.triaged ?? 0) : undefined} reason="Loading" icon={Bell} href="/admin/secops/alerts" sub={s ? `${s.total} in the 24-hour window` : undefined} />
                <KpiCard label="Open cases" value={c?.active} reason="Loading" icon={ShieldCheck} href="/admin/secops/cases" sub={c ? `${c.open} open · ${c.investigating} investigating` : undefined} />
                <KpiCard label="Critical cases" value={c?.critical} reason="Loading" icon={Siren} tone={c && c.critical > 0 ? 'critical' : 'good'} href="/admin/secops/cases" />
                <KpiCard label="Automated closures" value={s?.automated_closures} reason="Loading" icon={ListChecks} href="/admin/secops/alerts?status=closed" sub="Closed by policy" />
                <KpiCard label="Escalated alerts" value={s?.escalated} reason="Loading" icon={ArrowUpRight} tone={s && s.escalated > 0 ? 'warning' : 'good'} href="/admin/secops/alerts?status=escalated" />
                <KpiCard label="Pending approvals" value={approvals.data?.total} reason="Loading" tone={approvals.data && approvals.data.total > 0 ? 'warning' : 'good'} href="/admin/secops/approvals" sub="Awaiting a human decision" />
            </section>

            {admin.role === 'super_admin' && <AdvanceTime onDone={reloadAll} />}

            <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <SectionTitle title="Live event timeline" hint="Policy decisions, approvals and clock changes, newest first." action={<Link href="/admin/secops/alerts" className={btn('ghost')}>All alerts</Link>} />
                    {events.load.state === 'error' ? <p className="text-xs text-red">Could not load events.</p>
                        : !events.data ? <p className="text-xs text-foreground-muted">Loading…</p>
                            : events.data.events.length === 0 ? <p className="text-xs text-foreground-muted">No events recorded yet.</p>
                                : (
                                    <ul className="divide-y divide-border">
                                        {events.data.events.map((e) => (
                                            <li key={e.id} className="py-2 text-xs flex gap-3">
                                                <span className="text-[11px] text-foreground-muted whitespace-nowrap w-40 shrink-0">{fmtWat(e.at)}</span>
                                                <span className="flex-1 min-w-0"><span className="font-semibold text-foreground">{e.actor}</span> · {describe(e)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                </Card>
                <Card>
                    <SectionTitle title="Alerts by severity" hint="Last 24 hours" />
                    {s ? <BarList label="Alerts by severity" items={severityBars} /> : <p className="text-xs text-foreground-muted">Loading…</p>}
                </Card>
                <Card>
                    <SectionTitle title="Priority assets" hint="Highest open risk" action={<Link href="/admin/vms/assets" className={btn('ghost')}>Inventory</Link>} />
                    {dashboard.data?.lists.highest_risk_assets.length ? (
                        <ul className="space-y-1 text-xs">{dashboard.data.lists.highest_risk_assets.slice(0, 5).map((a) => <li key={a.asset_id} className="flex justify-between gap-2"><Link href={`/admin/vms/assets/${a.asset_id}`} className="font-mono text-blue">{a.value}</Link><span className="text-foreground-muted">{a.open} open</span></li>)}</ul>
                    ) : <p className="text-xs text-foreground-muted">No asset has open findings.</p>}
                </Card>
                <Card className="xl:col-span-2">
                    <SectionTitle title="Analyst workload" hint="Open, investigating and contained cases, by assignee" action={<Link href="/admin/secops/cases" className={btn('ghost')}>All cases</Link>} />
                    {cases.load.state === 'error' ? <p className="text-xs text-red">Could not load case data.</p>
                        : workload.length === 0 ? <p className="text-xs text-foreground-muted">{cases.load.state === 'loading' ? 'Loading…' : 'No active cases right now.'}</p>
                            : <BarList label="Active cases by assignee" items={workload} />}
                </Card>
            </div>
            <p className="text-[11px] text-foreground-muted flex items-center gap-1.5"><Radio className="w-3 h-3" aria-hidden /> Illustrative telemetry: every alert, case and approval here is a fictional record.</p>
        </div>
    );
}
