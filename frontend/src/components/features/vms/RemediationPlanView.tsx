'use client';

// Deterministic remediation plan for one finding (GET/POST /api/vms/remediation-plan). Nothing here
// calls an AI service. Approving records the decision and creates illustrative tasks; no patch is
// installed and no system is changed.

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { fmtWat } from '@/lib/vms';
import { PriorityBadge, SeverityBadge, Notice, btn, relTime, type Msg } from './kit';
import { Card, SectionTitle, StatusPill } from './ui';
import { useVmsData, useVmsCan, vmsSend } from './data';

interface Plan {
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
    review: { status: 'pending' | 'approved' | 'rejected'; decided_by: string | null; decided_at: string | null; reason: string | null };
    recorded_actions: { at: string; actor: string; action: string; details: string | null }[];
    disclaimer: string;
}

const REVIEW_TONE = { pending: { tone: 'warning', label: 'Awaiting review' }, approved: { tone: 'good', label: 'Approved' }, rejected: { tone: 'critical', label: 'Rejected' } } as const;

export function RemediationPlanView({ findingId, onChanged }: { findingId: string; onChanged?: () => void }) {
    const can = useVmsCan();
    const plan = useVmsData<{ plan: Plan }>(`/api/vms/remediation-plan?finding=${encodeURIComponent(findingId)}`);
    const [msg, setMsg] = useState<Msg>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const p = plan.data?.plan ?? null;

    async function decide(decision: 'approved' | 'rejected') {
        if (decision === 'rejected' && !reason.trim()) { setMsg({ ok: false, text: 'Enter a reason before rejecting the plan.' }); return; }
        setBusy(true);
        const r = await vmsSend<{ plan: Plan }>('POST', '/api/vms/remediation-plan', { finding: findingId, decision, reason: reason.trim() || null });
        setBusy(false);
        if (r.ok) {
            setMsg({ ok: true, text: decision === 'approved' ? 'Plan approved. Remediation tasks were created from the checklist; no patch was applied.' : 'Plan rejected and the reason recorded.' });
            setReason('');
            plan.reload();
            onChanged?.();
        } else {
            setMsg({ ok: false, text: r.error });
        }
    }

    if (plan.load.state === 'error') {
        return <Card><p role="alert" className="text-xs text-red font-semibold">{plan.load.error}</p></Card>;
    }
    if (!p) return <Card><p className="text-xs text-foreground-muted">Loading the remediation plan…</p></Card>;

    const review = REVIEW_TONE[p.review.status];
    const canDecide = can.manage && p.review.status === 'pending';

    return (
        <div className="space-y-4">
            <Notice msg={msg} />
            <Card>
                <div className="flex items-start gap-3 flex-wrap">
                    <ShieldCheck className="w-5 h-5 text-blue shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-black text-foreground">{p.finding.title}</h2>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                            <PriorityBadge priority={p.finding.priority} />
                            <SeverityBadge severity={p.finding.scanner_severity} />
                            <StatusPill tone={review.tone} label={review.label} />
                            <span className="text-foreground-muted">Finding {p.finding.id} · status {p.finding.status.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-[11px] text-foreground-muted mt-2">{p.disclaimer}</p>
                    </div>
                    <Link href={`/admin/vms/findings?id=${p.finding.id}`} className={btn('secondary')}>Open finding</Link>
                </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <SectionTitle title="Affected asset" />
                    {p.asset ? (
                        <dl className="text-xs space-y-1">
                            <div><dt className="inline text-foreground-muted">Asset: </dt><dd className="inline"><Link href={`/admin/vms/assets/${p.asset.id}`} className="font-mono text-blue">{p.asset.value}</Link></dd></div>
                            <div><dt className="inline text-foreground-muted">Criticality: </dt><dd className="inline capitalize">{p.asset.criticality}</dd></div>
                            <div><dt className="inline text-foreground-muted">Exposure: </dt><dd className="inline capitalize">{p.asset.exposure}</dd></div>
                            <div><dt className="inline text-foreground-muted">Asset owner: </dt><dd className="inline">{p.asset.owner ?? 'Not recorded'}</dd></div>
                        </dl>
                    ) : <p className="text-xs text-foreground-muted">{p.finding.asset_value} (asset record not found)</p>}
                </Card>

                <Card>
                    <SectionTitle title="CVE and severity" />
                    <p className="text-xs"><span className="text-foreground-muted">CVE: </span>{p.finding.cve_ids.length ? p.finding.cve_ids.join(', ') : 'No CVE recorded for this finding'}</p>
                    <p className="text-xs mt-1"><span className="text-foreground-muted">Scanner severity: </span><span className="capitalize">{p.finding.scanner_severity}</span></p>
                    {p.finding.description && <p className="text-xs text-foreground-muted mt-2">{p.finding.description}</p>}
                </Card>

                <Card>
                    <SectionTitle title="Business impact" />
                    <p className="text-xs">{p.business_impact}</p>
                </Card>

                <Card>
                    <SectionTitle title="Patch availability" />
                    <p className="text-xs"><StatusPill tone={p.patch.available ? 'good' : 'warning'} label={p.patch.available ? 'Fix recorded' : 'No fix recorded'} /></p>
                    <p className="text-xs mt-2">{p.patch.statement}</p>
                    {!p.patch.available && <p className="text-[11px] text-foreground-muted mt-1">Use the workaround or compensating control in the checklist until a fix exists.</p>}
                </Card>

                <Card>
                    <SectionTitle title="Risk prioritisation" />
                    <p className="text-xs flex items-center gap-2 flex-wrap"><PriorityBadge priority={p.risk_priority.priority} /> {p.risk_priority.risk_score !== null ? `Risk score ${p.risk_priority.risk_score}` : 'No risk score'}</p>
                    <p className="text-xs text-foreground-muted mt-2">{p.risk_priority.rationale}</p>
                    <p className="text-xs mt-2">Due {p.risk_priority.due_at ? `${fmtWat(p.risk_priority.due_at)} (${relTime(p.risk_priority.due_at, Date.now())})` : 'not set'}{p.risk_priority.overdue && <span className="ml-2 font-bold text-red">Overdue</span>}</p>
                </Card>

                <Card>
                    <SectionTitle title="Recommendations" />
                    <ul className="list-disc pl-4 space-y-1 text-xs">{p.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
                </Card>
            </div>

            <Card>
                <SectionTitle title="Remediation checklist" hint="Each step becomes a remediation task when the plan is approved." />
                <ol className="space-y-2 text-xs">
                    {p.checklist.map((c) => (
                        <li key={c.order} className="flex gap-3 border-b border-border last:border-0 pb-2">
                            <span className="font-black text-foreground-muted w-5 shrink-0">{c.order}.</span>
                            <span className="flex-1">{c.action}</span>
                            <span className="text-[11px] text-foreground-muted whitespace-nowrap">{c.owner_suggestion ?? 'Owner to assign'} · within {c.deadline_days} day{c.deadline_days === 1 ? '' : 's'}</span>
                        </li>
                    ))}
                </ol>
            </Card>

            <Card>
                <SectionTitle title="Review and approval" hint="An analyst decides. Approval records the decision and creates tasks; it does not change any system." />
                {p.review.status !== 'pending' ? (
                    <p className="text-xs">
                        {p.review.status === 'approved' ? 'Approved' : 'Rejected'} by {p.review.decided_by ?? 'an analyst'}{p.review.decided_at ? ` on ${fmtWat(p.review.decided_at)}` : ''}.
                        {p.review.reason && <span className="block text-foreground-muted mt-1">Reason: {p.review.reason}</span>}
                    </p>
                ) : canDecide ? (
                    <div className="space-y-2">
                        <label className="block text-xs">
                            <span className="text-foreground-muted">Reason (required to reject)</span>
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-xs bg-card" />
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            <button disabled={busy} onClick={() => void decide('approved')} className={btn('primary', 'md')}>Approve plan and create tasks</button>
                            <button disabled={busy} onClick={() => void decide('rejected')} className={btn('secondary', 'md')}>Reject plan</button>
                        </div>
                    </div>
                ) : <p className="text-xs text-foreground-muted">Awaiting review. Your role can view this plan but cannot decide it.</p>}
            </Card>

            <Card>
                <SectionTitle title="Recorded actions" />
                {p.recorded_actions.length === 0 ? <p className="text-xs text-foreground-muted">Nothing recorded for this finding yet.</p> : (
                    <ul className="space-y-1 text-[11px]">
                        {p.recorded_actions.map((a, i) => <li key={`${a.at}-${i}`}><span className="font-mono text-foreground-muted">{fmtWat(a.at)}</span> · {a.actor} · {a.action.replace(/[._]/g, ' ')}</li>)}
                    </ul>
                )}
            </Card>
        </div>
    );
}
