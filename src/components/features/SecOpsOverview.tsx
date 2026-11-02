'use client';

// SOC Management overview — one glance at what's running right now. Every number here is read
// straight from the same records Cases, Alerts, Approvals, Remediation and Team Management use;
// nothing is computed or estimated separately from them.

import { Radio, Users, Siren, Bell, ArrowUpRight, Bug, ListChecks } from 'lucide-react';
import { KpiCard, btn } from './vms/kit';
import { Card, SectionTitle } from './vms/ui';
import { BarList, type BarItem } from './vms/charts';
import { useVmsData } from './vms/data';

interface CaseRow { severity: string; status: string; assigned_to: string | null }
interface CaseSummary { cases: CaseRow[]; summary: { open: number; investigating: number; closed: number; active: number; critical: number } }
interface AlertStats { total: number; by_status: Record<string, number> }
interface Approval { status: string }
interface ApprovalList { approvals: Approval[] }
interface Dashboard { kpis: { critical_open: number; overdue_tasks: number } }
interface TeamMember { id: string; name: string; email: string; role: string; disabled: boolean }
interface TeamList { members: TeamMember[] }
interface HandoverLog { analystOn: string; analystOff: string; shiftStart: string; shiftEnd: string }
interface HandoverList { logs: HandoverLog[] }

export function SecOpsOverview() {
    const cases = useVmsData<CaseSummary>('/api/cases');
    const alerts = useVmsData<AlertStats>('/api/alerts/stats');
    const approvals = useVmsData<ApprovalList>('/api/approvals');
    const dashboard = useVmsData<Dashboard>('/api/vms/dashboard?days=7');
    const team = useVmsData<TeamList>('/api/secops/team');
    const handover = useVmsData<HandoverList>('/api/secops/handover');

    const latestHandover = handover.data?.logs[0] ?? null;
    const pendingApprovals = approvals.data?.approvals.filter((a) => a.status === 'pending').length ?? null;
    const pendingActions = dashboard.data && pendingApprovals !== null ? dashboard.data.kpis.overdue_tasks + pendingApprovals : null;
    const activeStaff = team.data?.members.filter((m) => !m.disabled) ?? null;

    const workload: BarItem[] = cases.data
        ? Object.entries(
            cases.data.cases
                .filter((c) => c.status === 'open' || c.status === 'investigating')
                .reduce<Record<string, number>>((acc, c) => {
                    const key = c.assigned_to || 'Unassigned';
                    acc[key] = (acc[key] ?? 0) + 1;
                    return acc;
                }, {}),
        )
            .sort((a, b) => b[1] - a[1])
            .map(([label, value]) => ({ key: label, label, value, token: label === 'Unassigned' ? '--vz-neutral' : '--vz-prog-3' }))
        : [];

    return (
        <div className="space-y-4">
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Active shift" text={latestHandover ? latestHandover.analystOn : handover.load.state === 'loading' ? undefined : 'Not yet established'}
                    reason="Loading" icon={Radio} sub={latestHandover ? `Since ${new Date(latestHandover.shiftStart).toLocaleString()}` : 'Generate a handover to begin tracking'} />
                <KpiCard label="Assigned analysts" value={activeStaff ? activeStaff.length : null} reason="Loading" icon={Users} href="/admin/settings/team" sub="Active team accounts" />
                <KpiCard label="Open incidents" value={cases.data?.summary.active} reason="Loading" icon={Siren} tone={cases.data && cases.data.summary.critical > 0 ? 'critical' : 'good'} href="/admin/secops/cases"
                    sub={cases.data ? `${cases.data.summary.critical} critical` : undefined} />
                <KpiCard label="Alerts (24h)" value={alerts.data?.total} reason="Loading" icon={Bell} href="/admin/secops/alerts" sub={alerts.data ? `${alerts.data.by_status.new ?? 0} new` : undefined} />
                <KpiCard label="Escalations" value={alerts.data ? alerts.data.by_status.escalated ?? 0 : null} reason="Loading" icon={ArrowUpRight}
                    tone={alerts.data && (alerts.data.by_status.escalated ?? 0) > 0 ? 'warning' : 'good'} href="/admin/secops/alerts?status=escalated" />
                <KpiCard label="High-priority vulnerabilities" value={dashboard.data?.kpis.critical_open} reason="Loading" icon={Bug}
                    tone={dashboard.data && dashboard.data.kpis.critical_open > 0 ? 'critical' : 'good'} href="/admin/vms/findings?severity=critical" />
                <KpiCard label="Pending actions" value={pendingActions} reason="Loading" icon={ListChecks} tone={pendingActions !== null && pendingActions > 0 ? 'warning' : 'good'}
                    sub={dashboard.data && pendingApprovals !== null ? `${dashboard.data.kpis.overdue_tasks} overdue tasks · ${pendingApprovals} approvals` : undefined} />
            </section>

            <Card>
                <SectionTitle title="Analyst workload" hint="Open and investigating cases, by assignee" action={<a href="/admin/secops/cases" className={btn('ghost')}>All cases</a>} />
                {cases.load.state === 'error' ? <p className="text-xs text-red">Could not load case data.</p>
                    : workload.length === 0 ? <p className="text-xs text-foreground-muted">{cases.load.state === 'loading' ? 'Loading…' : 'No open or investigating cases right now.'}</p>
                        : <BarList label="Open cases by assignee" items={workload} />}
            </Card>
        </div>
    );
}
