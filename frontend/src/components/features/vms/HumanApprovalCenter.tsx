'use client';

// Human Approval Center: critical-case response requests waiting for an analyst's decision.
// Decisions are recorded in the shared SOC state. Nothing here executes a response action: an
// approval records the human decision and the case timeline, and no host, network or account is
// changed.

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { fmtWat } from '@/lib/vms';
import { PageHeader, SeverityBadge, Segmented, Drawer, Notice, btn, type Msg } from './kit';
import { Card, SectionTitle, StatusPill } from './ui';
import { DataTable, type Column } from './table';
import { useVmsData, vmsSend } from './data';

interface Approval {
    id: string; case_id: string; alert_id: string | null; asset_id: string | null; action: string; target: string; severity: string; status: string;
    requested_at: string; requested_by: string; approver: string | null; explanation: string; evidence: string[]; risk_impact: string; sla_due_at: string;
    decided_at: string | null; decided_by: string | null; decision_reason: string | null;
    history: { at: string; actor: string; action: string; reason: string | null }[];
}

const STATUS: Record<string, { tone: 'warning' | 'good' | 'critical' | 'neutral'; label: string }> = {
    pending: { tone: 'warning', label: 'Awaiting decision' },
    info_requested: { tone: 'neutral', label: 'More information requested' },
    approved: { tone: 'good', label: 'Approved' },
    rejected: { tone: 'critical', label: 'Rejected' },
};

export function HumanApprovalCenter() {
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [openId, setOpenId] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);
    const list = useVmsData<{ approvals: Approval[]; total: number }>(`/api/approvals${filter === 'pending' ? '?status=pending' : ''}`);
    const rows = list.data?.approvals ?? null;
    const current = rows?.find((a) => a.id === openId) ?? null;
    const now = list.at ?? 0;
    const decidable = current && (current.status === 'pending' || current.status === 'info_requested');

    async function decide(decision: 'approved' | 'rejected' | 'info_requested') {
        if (!current) return;
        if (decision !== 'approved' && !reason.trim()) {
            setMsg({ ok: false, text: decision === 'rejected' ? 'Enter a reason to reject this request.' : 'Say what further investigation is needed.' });
            return;
        }
        setBusy(true);
        const r = await vmsSend<{ approval: Approval }>('POST', `/api/approvals/${current.id}/decision`, { decision, reason: reason.trim() || null });
        setBusy(false);
        if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
        setReason('');
        setMsg({ ok: true, text: decision === 'approved' ? 'Approval recorded in the case timeline. The action was not executed.' : decision === 'rejected' ? 'Rejection and reason recorded.' : 'Further investigation requested and recorded.' });
        list.reload();
    }

    const columns: Column<Approval>[] = [
        { key: 'id', header: 'Approval', render: (a) => <span className="font-mono text-[11px]">{a.id}</span> },
        { key: 'case', header: 'Case', render: (a) => <Link href={`/admin/secops/cases?id=${a.case_id}`} className="font-mono text-[11px] text-blue hover:underline" onClick={(e) => e.stopPropagation()}>{a.case_id}</Link> },
        { key: 'alert', header: 'Critical alert', hideBelow: 'md', render: (a) => <span className="font-mono text-[11px]">{a.alert_id ?? '—'}</span> },
        { key: 'target', header: 'Affected asset', className: 'min-w-[160px]', render: (a) => <span className="font-mono text-[11px]">{a.target}</span> },
        { key: 'severity', header: 'Severity', render: (a) => <SeverityBadge severity={a.severity} /> },
        { key: 'action', header: 'Recommended action', render: (a) => <span className="text-[11px] capitalize">{a.action.replace(/_/g, ' ')}</span> },
        { key: 'approver', header: 'Approver', hideBelow: 'lg', render: (a) => <span className="text-[11px]">{a.approver ?? 'Unassigned'}</span> },
        { key: 'status', header: 'Status', render: (a) => <StatusPill tone={STATUS[a.status]?.tone ?? 'neutral'} label={STATUS[a.status]?.label ?? a.status} /> },
        { key: 'requested', header: 'Requested', hideBelow: 'lg', sort: (a) => a.requested_at, render: (a) => <span className="text-[11px] text-foreground-muted whitespace-nowrap">{fmtWat(a.requested_at)}</span> },
        { key: 'sla', header: 'SLA', hideBelow: 'lg', sort: (a) => a.sla_due_at, render: (a) => <span className={`text-[11px] whitespace-nowrap ${a.status === 'pending' && Date.parse(a.sla_due_at) < now ? 'text-red font-semibold' : 'text-foreground-muted'}`}>{fmtWat(a.sla_due_at)}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={ShieldCheck} title="Human Approval Center"
                description="Sensitive response actions proposed for critical cases wait here for an analyst's decision. The policy and any AI suggestion are advisory; approving records a decision only and executes nothing." />
            <Notice msg={msg} />
            <Segmented label="Show" value={filter} onChange={setFilter} options={[['pending', 'Awaiting decision'], ['all', 'All requests']]} />
            {list.load.state === 'error' ? <p role="alert" className="text-xs text-red font-semibold">Could not load approvals: {list.load.error}</p> : null}
            <DataTable caption="Approval requests" rows={rows} columns={columns} rowKey={(a) => a.id} onRowClick={(a) => { setOpenId(a.id); setReason(''); setMsg(null); }}
                initialSort={{ key: 'requested', dir: 'desc' }} empty={filter === 'pending' ? 'No critical response request is waiting for a decision.' : 'No approval requests.'} />

            <Drawer open={!!current} onClose={() => setOpenId(null)} title={current ? `${current.id} · ${current.case_id}` : 'Approval request'}>
                {current && (
                    <div className="space-y-4 text-xs">
                        <div className="flex flex-wrap gap-2 items-center">
                            <SeverityBadge severity={current.severity} />
                            <StatusPill tone={STATUS[current.status]?.tone ?? 'neutral'} label={STATUS[current.status]?.label ?? current.status} />
                            <span className="text-foreground-muted">Requested by {current.requested_by} at {fmtWat(current.requested_at)}</span>
                        </div>
                        <Card>
                            <SectionTitle title="Recommended action" />
                            <p className="capitalize">{current.action.replace(/_/g, ' ')} on <span className="font-mono">{current.target}</span> (simulated; not executed)</p>
                            <p className="mt-2 text-foreground-muted">{current.explanation}</p>
                            <p className="mt-2"><span className="text-foreground-muted">Risk and impact: </span>{current.risk_impact}</p>
                            <p className="mt-2"><span className="text-foreground-muted">Assigned approver: </span>{current.approver ?? 'Unassigned'} · SLA {fmtWat(current.sla_due_at)}</p>
                        </Card>
                        <Card>
                            <SectionTitle title="Supporting evidence" />
                            <ul className="list-disc pl-4 space-y-1">{current.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                            {current.alert_id && <p className="mt-2"><Link href={`/admin/secops/alerts?id=${current.alert_id}`} className="text-blue hover:underline">Open alert {current.alert_id}</Link></p>}
                        </Card>
                        <Card>
                            <SectionTitle title="Decision history" />
                            <ol className="space-y-1">
                                {current.history.map((h, i) => <li key={`${h.at}-${i}`}><span className="font-mono text-foreground-muted">{fmtWat(h.at)}</span> · {h.actor} · {h.action.replace(/_/g, ' ')}{h.reason ? ` — ${h.reason}` : ''}</li>)}
                            </ol>
                        </Card>
                        {decidable ? (
                            <Card>
                                <SectionTitle title="Your decision" hint="Rejecting and requesting more information need a reason. Approval records the decision only." />
                                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-label="Reason" className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-card" placeholder="Reason (required to reject or request more information)" />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <button disabled={busy} onClick={() => void decide('approved')} className={btn('primary', 'md')}>Approve</button>
                                    <button disabled={busy} onClick={() => void decide('info_requested')} className={btn('secondary', 'md')}>Request more information</button>
                                    <button disabled={busy} onClick={() => void decide('rejected')} className={btn('secondary', 'md')}>Reject</button>
                                </div>
                            </Card>
                        ) : (
                            <p className="text-foreground-muted">This request has a final decision and cannot be decided again.</p>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
}
