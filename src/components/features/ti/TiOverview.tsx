'use client';

// Threat Intelligence — Overview. Headline counts, source freshness, this organisation's new
// matches, newly listed known exploited vulnerabilities, and an AI briefing grounded in those
// records. Every figure comes from /api/ti or /api/vms/risk; a figure that could not be read says
// so instead of showing 0.

import Link from 'next/link';
import { Crosshair, Target, Fingerprint, ShieldAlert, Radio, Globe } from 'lucide-react';
import { PageHeader, KpiCard, EmptyState, ErrorState, Tag, btn } from '@/components/features/vms/kit';
import { Card, SectionTitle, Skeleton } from '@/components/features/vms/ui';
import { useVmsData } from '@/components/features/vms/data';
import { AiPanel } from '@/components/shared/AiPanel';
import { fmtWat } from '@/lib/vms';
import { Freshness, Citation } from './common';
import { FEED_NAME, ago, type TiFeed, type TiMatch, type TiVulnerability } from '@/lib/ti';

interface Overview { indicators: { active: number; new_last_24h: number; by_type: Record<string, number> }; matches: { new: number; total: number }; feeds: TiFeed[] }
interface RiskSummary { exposure: { internet: number; internal: number } }

export function TiOverview() {
    const ov = useVmsData<Overview>('/api/ti/overview');
    const risk = useVmsData<RiskSummary>('/api/vms/risk');
    const matches = useVmsData<{ matches: TiMatch[] }>('/api/ti/matches?status=new');
    const kev = useVmsData<{ total: number; vulnerabilities: TiVulnerability[] }>('/api/ti/vulnerabilities?days=30&page_size=5');
    const now = ov.at ?? 0;
    const feeds = (ov.data?.feeds ?? []).filter((f) => f.id !== 'opencti');
    const healthy = feeds.filter((f) => f.configured !== false && f.enabled && !f.failing && !f.stale).length;
    const live = feeds.filter((f) => f.configured !== false && f.enabled).length;

    return (
        <div className="space-y-5">
            <PageHeader title="Threat Intelligence" icon={Crosshair}
                description="Indicators from public feeds and partner sharing, matched against this organisation's alerts, assets, findings and cases. Every claim is shown with its source."
                actions={<Link href="/admin/ti/analyst" className={btn('primary')}>Ask the AI analyst</Link>} />

            {ov.load.state === 'error' ? <ErrorState error={ov.load.error} status={ov.load.status} onRetry={ov.reload} /> : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <KpiCard label="Active indicators" value={ov.data?.indicators.active} reason="Loading" icon={Fingerprint} href="/admin/ti/indicators" hint="Indicators within their source's validity window" />
                    <KpiCard label="New in 24 h" value={ov.data?.indicators.new_last_24h} reason="Loading" href="/admin/ti/indicators?sort=created_at" />
                    <KpiCard label="Your new matches" value={ov.data?.matches.new} reason="Loading" icon={Target} href="/admin/ti/matches" tone={ov.data && ov.data.matches.new > 0 ? 'serious' : undefined} hint="Indicators seen in your records, not yet reviewed" />
                    <KpiCard label="Internet-exposed open findings" value={risk.data?.exposure.internet ?? (risk.load.state === 'error' ? null : undefined)} reason={risk.load.state === 'error' ? risk.load.error : 'Loading'} icon={Globe} href="/admin/vms/risk/exposure" hint="Open vulnerability findings on internet-facing assets — this organisation's own exposure, not a public report" />
                    <KpiCard label="KEV added, 30 d" value={kev.data?.total ?? (kev.load.state === 'error' ? null : undefined)} reason={kev.load.state === 'error' ? kev.load.error : 'Loading'} icon={ShieldAlert} href="/admin/ti/vulnerabilities" />
                    <KpiCard label="Sources current" text={ov.data ? `${healthy} / ${live}` : undefined} value={ov.data ? undefined : null} reason="Loading" icon={Radio} href="/admin/ti/sources" tone={ov.data ? (healthy === live ? 'good' : healthy === 0 ? 'critical' : 'warning') : undefined} />
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2">
                    <SectionTitle title="Indicators by type" hint="Active indicators across all configured sources" />
                    {ov.load.state === 'loading' ? <Skeleton className="h-32" /> : ov.data ? (
                        <ul className="divide-y divide-border">
                            {Object.entries(ov.data.indicators.by_type).map(([type, count]) => (
                                <li key={type} className="py-2.5 flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold text-foreground capitalize">{type}</span>
                                    <span className="text-xs tabular-nums text-foreground-muted">{count}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <EmptyState compact title="No indicators yet" />}
                </Card>

                <Card>
                    <SectionTitle title="Source freshness" action={<Link href="/admin/ti/sources" className={btn('ghost')}>Sources</Link>} />
                    {ov.load.state === 'loading' ? <Skeleton className="h-32" /> : (
                        <ul className="space-y-2">
                            {feeds.map((f) => (
                                <li key={f.id} className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-foreground">{FEED_NAME[f.id] ?? f.name}</span>
                                    <Freshness lastSuccess={f.last_success_at} stale={f.stale} failing={f.failing} configured={f.configured} enabled={f.enabled} now={now} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                    <SectionTitle title="Your new matches" hint="Indicators seen in this organisation's records" action={<Link href="/admin/ti/matches" className={btn('ghost')}>All matches</Link>} />
                    {matches.load.state === 'loading' ? <Skeleton className="h-28" /> : matches.load.state === 'error' ? <ErrorState error={matches.load.error} status={matches.load.status} onRetry={matches.reload} /> : matches.data!.matches.length ? (
                        <ul className="divide-y divide-border">
                            {matches.data!.matches.slice(0, 6).map((m) => (
                                <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                        <Link href={`/admin/ti/indicators?id=${m.indicator_id}`} className="text-xs font-mono font-semibold text-foreground hover:text-purple truncate block">{m.ti_indicators?.value ?? m.matched_value}</Link>
                                        <span className="text-[11px] text-foreground-muted">in {m.entity_type} · {m.matched_field}</span>
                                    </span>
                                    <span className="text-[11px] text-foreground-muted shrink-0" title={fmtWat(m.first_matched_at)}>{ago(m.first_matched_at, now)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <EmptyState compact title="No new matches" body="None of the active indicators has been seen in your records since the last review." />}
                </Card>

                <Card>
                    <SectionTitle title="Known exploited, newly listed" hint="CISA KEV additions in the last 30 days" action={<Link href="/admin/ti/vulnerabilities" className={btn('ghost')}>Vulnerabilities</Link>} />
                    {kev.load.state === 'loading' ? <Skeleton className="h-28" /> : kev.load.state === 'error' ? <ErrorState error={kev.load.error} status={kev.load.status} onRetry={kev.reload} /> : kev.data!.vulnerabilities.length ? (
                        <ul className="divide-y divide-border">
                            {kev.data!.vulnerabilities.map((v) => (
                                <li key={v.cve} className="py-2 flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="text-xs font-mono font-semibold text-foreground">{v.cve}</span>
                                        <span className="block text-[11px] text-foreground-muted truncate">{[v.kev.vendor, v.kev.product].filter(Boolean).join(' ')}{v.kev.name ? ` — ${v.kev.name}` : ''}</span>
                                    </span>
                                    {v.your_open_findings ? <Tag strong>{v.your_open_findings} open finding{v.your_open_findings > 1 ? 's' : ''}</Tag> : <Citation feed="cisa_kev" at={v.added} now={now} />}
                                </li>
                            ))}
                        </ul>
                    ) : <EmptyState compact title="No new KEV entries" body="CISA added nothing to the catalogue in the last 30 days (or the KEV feed has not run)." />}
                </Card>
            </div>

            <AiPanel purpose="threat_briefing" subjectId="7d" title="AI briefing" />
        </div>
    );
}
