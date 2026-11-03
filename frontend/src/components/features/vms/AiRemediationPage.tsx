'use client';

// /admin/vms/remediation/ai — the remediation plan for one finding (?finding=<id>), or the open
// P1/P2 findings to choose from. The plan is deterministic and works without an AI service; the
// optional AI assistant below it reports honestly when AI is not configured.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { AiPanel } from '@/components/shared/AiPanel';
import { PageHeader, PriorityBadge, SeverityBadge, ErrorState, EmptyState, btn } from './kit';
import { Card, SectionTitle } from './ui';
import { RemediationPlanView } from './RemediationPlanView';
import { useVmsData } from './data';

interface QueueItem { id: string; title: string; asset_value: string; priority: string | null; scanner_severity: string; status: string }

export function AiRemediationPage() {
    const params = useSearchParams();
    const findingId = params.get('finding')?.trim() ?? '';
    const queue = useVmsData<{ items: QueueItem[] }>(findingId ? null : '/api/vms/remediation');

    if (findingId) {
        return (
            <div className="space-y-5">
                <PageHeader icon={Sparkles} title="Remediation plan"
                    description="Deterministic remediation plan for one finding, built from the stored finding and its asset. Approving creates remediation tasks; nothing is patched or changed on any system."
                    actions={<Link href="/admin/vms/remediation/ai" className={btn('secondary', 'md')}><ArrowLeft className="w-3.5 h-3.5" aria-hidden /> All findings</Link>} />
                <RemediationPlanView findingId={findingId} />
                <Card>
                    <SectionTitle title="AI assistant (optional)" hint="Uses the configured AI service for an additional explanation. The plan above does not depend on it." />
                    <AiPanel key={findingId} purpose="remediation_plan" subjectId={findingId} title="AI assistant suggestion (draft, review before acting)" />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <PageHeader icon={Sparkles} title="Remediation plans"
                description="Choose a finding to see its remediation plan: affected asset, CVE, business impact, patch availability, checklist and the approval step." />
            {queue.load.state === 'error' ? <ErrorState error={queue.load.error} status={queue.load.status} onRetry={queue.reload} />
                : queue.load.state === 'loading' && !queue.data ? <Card><p className="text-xs text-foreground-muted">Loading findings…</p></Card>
                    : (
                        <Card>
                            <SectionTitle title="Open P1 and P2 findings" />
                            {(queue.data?.items ?? []).filter((f) => f.priority === 'P1' || f.priority === 'P2').length === 0
                                ? <EmptyState icon={Sparkles} title="No open P1 or P2 findings" body="Nothing needs a remediation plan right now." />
                                : (
                                    <ul className="divide-y divide-border">
                                        {(queue.data?.items ?? []).filter((f) => f.priority === 'P1' || f.priority === 'P2').map((f) => (
                                            <li key={f.id} className="py-2 flex items-center gap-3 flex-wrap">
                                                <PriorityBadge priority={f.priority} />
                                                <SeverityBadge severity={f.scanner_severity} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-foreground truncate">{f.title}</p>
                                                    <p className="text-[11px] font-mono text-foreground-muted truncate">{f.asset_value} · {f.id}</p>
                                                </div>
                                                <Link href={`/admin/vms/remediation/ai?finding=${encodeURIComponent(f.id)}`} className={btn('secondary')}>Open plan</Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                        </Card>
                    )}
        </div>
    );
}
