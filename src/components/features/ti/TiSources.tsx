
'use client';

// Threat Intelligence — Sources & Intelligence Exchange.
// The frontend catalogue ensures that expected threat sources remain visible,
// even when they are missing from the backend response.

import { useState } from 'react';
import { Radio, Play, Copy, Download, KeyRound } from 'lucide-react';
import {
    PageHeader,
    ErrorState,
    EmptyState,
    Notice,
    ConfirmDialog,
    btn,
    nf,
    type Msg,
} from '@/components/features/vms/kit';
import { Card, SectionTitle, Skeleton, StatusPill } from '@/components/features/vms/ui';
import { DataTable, type Column } from '@/components/features/vms/table';
import { BarList } from '@/components/features/vms/charts';
import {
    useVmsData,
    useVmsCan,
    vmsSend,
} from '@/components/features/vms/data';
import { apiFetch, apiUrl } from '@/lib/api';
import { fmtWat } from '@/lib/vms';
import { Freshness, TlpBadge, Field } from './common';
import {
    FEED_NAME,
    ago,
    TLP_LABEL,
    type TiSources as Sources,
    type TiFeed,
    type TiRun,
    type TaxiiClient,
    type MispCheck,
    type Tlp,
} from '@/lib/ti';

/**
 * Frontend threat-source catalogue.
 *
 * These entries guarantee visibility in the UI.
 * Match IDs to your application's actual feed IDs when known.
 *
 * A catalogue entry is NOT proof that a source is integrated.
 */
const ALL_THREAT_SOURCES: Array<{ id: string; name: string }> = [
    { id: 'nvd', name: 'NVD / NIST CVE Database' },
    { id: 'epss', name: 'FIRST EPSS' },
    { id: 'cisa_kev', name: 'CISA Known Exploited Vulnerabilities' },
    { id: 'mitre_attack', name: 'MITRE ATT&CK' },
    { id: 'urlhaus', name: 'URLhaus' },
    { id: 'threatfox', name: 'ThreatFox' },
    { id: 'feodo_tracker', name: 'Feodo Tracker' },
    { id: 'openphish', name: 'OpenPhish' },
    { id: 'phishstats', name: 'PhishStats' },
    { id: 'abuse_ch', name: 'abuse.ch Threat Intelligence' },
    { id: 'misp', name: 'MISP' },
    { id: 'otx', name: 'AlienVault OTX' },
    { id: 'virustotal', name: 'VirusTotal' },
    { id: 'greynoise', name: 'GreyNoise' },
    { id: 'shodan', name: 'Shodan' },
    { id: 'ibm_xforce', name: 'IBM X-Force Exchange' },
    { id: 'mandiant', name: 'Google Threat Intelligence' },
    { id: 'malwarebazaar', name: 'MalwareBazaar' },
    { id: 'ransomware_live', name: 'Ransomware.live' },
    { id: 'urlscan', name: 'urlscan.io' },
    { id: 'alienvault_otx', name: 'AlienVault OTX (Community Feed)' },
    { id: 'phishtank', name: 'PhishTank' },
    { id: 'cert_eu', name: 'CERT-EU Advisories' },
    { id: 'ncert', name: 'National CERT Advisories' },
    { id: 'vendor_advisories', name: 'Security Vendor Advisories' },
    { id: 'github_advisories', name: 'GitHub Security Advisories' },
    { id: 'osv', name: 'OSV Vulnerability Database' },
    { id: 'exploit_db', name: 'Exploit Database' },
    { id: 'packetstorm', name: 'Packet Storm Security' },
    { id: 'ransomware_groups', name: 'Ransomware Group Intelligence' },
    { id: 'dark_web', name: 'Dark Web Intelligence' },
    { id: 'social_intelligence', name: 'Social Media Threat Intelligence' },
    { id: 'nigeria_cert', name: 'Nigeria CERT / National Cybersecurity Advisories' },
    { id: 'ng_threat_feed', name: 'Nigeria Threat Intelligence Feed' },
    { id: 'custom_feed', name: 'Custom Threat Intelligence Feed' },
];

const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
};

export function TiSources() {
    const src = useVmsData<Sources>('/api/ti/sources');
    const can = useVmsCan();
    const manager = can.scope;

    const clients = useVmsData<{ clients: TaxiiClient[] }>(
        manager ? '/api/ti/exchange/clients' : null,
    );

    const [msg, setMsg] = useState<Msg>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [check, setCheck] = useState<MispCheck | null>(null);

    const [creds, setCreds] = useState<{
        username: string;
        password: string;
        name: string;
    } | null>(null);

    const [revoke, setRevoke] = useState<TaxiiClient | null>(null);
    const [name, setName] = useState('');
    const [cols, setCols] = useState<string[]>([]);
    const [maxTlp, setMaxTlp] = useState<'clear' | 'green' | 'amber'>('clear');

    const now = src.at ?? 0;
    const d = src.data;

    /**
     * Merge API feeds with the frontend catalogue.
     *
     * Existing API records take precedence, preserving real status,
     * timestamps, errors, counts, and configuration.
     *
     * Missing catalogue records receive safe placeholder values.
     */
    const displayFeeds: (TiFeed & { retired?: boolean })[] = (() => {
        const feeds = (d?.feeds ?? []).slice() as (
            TiFeed & { retired?: boolean }
        )[];

        for (const source of ALL_THREAT_SOURCES) {
            const existing = feeds.find((feed) => feed.id === source.id);

            if (existing) {
                continue;
            }

            feeds.push({
                id: source.id,
                name: source.name,
                configured: false,
                enabled: false,
                stale: true,
                failing: false,
                retired: false,
                last_success_at: null,
                last_run_at: null,
                last_counts: null,
                last_error: null,
            } as TiFeed & { retired?: boolean });
        }

        return feeds;
    })();

    async function runFeed(feed: TiFeed) {
        setBusy(feed.id);

        try {
            const result = await vmsSend<{
                status: string;
                counts?: Record<string, number>;
                error?: string;
            }>('POST', `/api/ti/feeds/${feed.id}/run`);

            setMsg(
                result.ok
                    ? {
                          ok: true,
                          text: `${FEED_NAME[feed.id] ?? feed.name}: ${JSON.stringify(
                              result.data.counts ?? {},
                          )}`,
                      }
                    : { ok: false, text: result.error },
            );

            src.reload();
        } finally {
            setBusy(null);
        }
    }

    async function checkMisp() {
        setBusy('misp');

        try {
            const result = await vmsSend<{ misp: MispCheck }>(
                'POST',
                '/api/ti/sources/misp/check',
            );

            if (result.ok) {
                setCheck(result.data.misp);
            } else {
                setMsg({ ok: false, text: result.error });
            }
        } finally {
            setBusy(null);
        }
    }

    async function createClient() {
        setBusy('client');

        try {
            const result = await vmsSend<{
                credentials: {
                    username: string;
                    password: string;
                };
            }>('POST', '/api/ti/exchange/clients', {
                name: name.trim(),
                collections: cols,
                max_tlp: maxTlp,
            });

            if (!result.ok) {
                setMsg({ ok: false, text: result.error });
                return;
            }

            setCreds({
                ...result.data.credentials,
                name: name.trim(),
            });

            setName('');
            setCols([]);
            setMaxTlp('clear');
            clients.reload();
        } finally {
            setBusy(null);
        }
    }

    async function doRevoke(client: TaxiiClient) {
        const result = await vmsSend(
            'POST',
            `/api/ti/exchange/clients/${client.id}/revoke`,
        );

        setRevoke(null);

        setMsg(
            result.ok
                ? {
                      ok: true,
                      text: `${client.name} revoked. Its credentials no longer work.`,
                  }
                : { ok: false, text: result.error },
        );

        clients.reload();
    }

    async function download(
        collection: string,
        ceiling: 'clear' | 'green' | 'amber',
    ) {
        setBusy(`dl-${collection}-${ceiling}`);

        try {
            const result = await apiFetch(
                apiUrl(
                    `/api/ti/export/stix?collection=${encodeURIComponent(
                        collection,
                    )}&ceiling=${encodeURIComponent(ceiling)}`,
                ),
            );

            if (!result.ok) {
                const error = await result.json().catch(() => null);

                setMsg({
                    ok: false,
                    text: error?.error ?? `HTTP ${result.status}`,
                });

                return;
            }

            const blob = await result.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = `novrsoc-${collection}-${ceiling}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            URL.revokeObjectURL(url);

            if (result.headers.get('X-NCC SOC-Truncated') === 'true') {
                setMsg({
                    ok: true,
                    text: 'The bundle holds the first 5,000 objects; use TAXII for the full collection.',
                });
            }
        } catch {
            setMsg({
                ok: false,
                text: 'The STIX export failed. Please try again.',
            });
        } finally {
            setBusy(null);
        }
    }

    const feedCols: Column<TiFeed & { retired?: boolean }>[] = [
        {
            key: 'name',
            header: 'Source',
            render: (feed) => (
                <span className="text-xs font-semibold">
                    {FEED_NAME[feed.id] ?? feed.name}
                </span>
            ),
            sort: (feed) => feed.name,
        },
        {
            key: 'state',
            header: 'State',
            render: (feed) => (
                <Freshness
                    lastSuccess={feed.last_success_at}
                    stale={feed.stale}
                    failing={feed.failing}
                    configured={feed.configured}
                    retired={feed.retired}
                    enabled={feed.enabled}
                    now={now}
                />
            ),
        },
        {
            key: 'last',
            header: 'Last run',
            render: (feed) => (
                <span
                    className="text-[11px] text-foreground-muted"
                    title={feed.last_run_at ? fmtWat(feed.last_run_at) : ''}
                >
                    {ago(feed.last_run_at, now)}
                </span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'counts',
            header: 'Last counts',
            render: (feed) =>
                feed.last_counts ? (
                    <span className="text-[11px] text-foreground-muted tabular-nums">
                        {feed.last_counts.fetched} fetched ·{' '}
                        {feed.last_counts.new} new ·{' '}
                        {feed.last_counts.updated} updated ·{' '}
                        {feed.last_counts.duplicates} dup ·{' '}
                        {feed.last_counts.invalid} invalid
                    </span>
                ) : (
                    <span className="text-[11px] text-foreground-muted">—</span>
                ),
            hideBelow: 'lg',
        },
        {
            key: 'error',
            header: 'Last error',
            render: (feed) =>
                feed.last_error ? (
                    <span className="text-[11px] text-red break-words">
                        {feed.last_error.slice(0, 160)}
                    </span>
                ) : (
                    <span className="text-[11px] text-foreground-muted">
                        none
                    </span>
                ),
            hideBelow: 'md',
        },
        {
            key: 'run',
            header: '',
            render: (feed) =>
                manager &&
                !feed.retired &&
                feed.configured !== false ? (
                    <button
                        type="button"
                        className={btn('ghost')}
                        disabled={!!busy}
                        onClick={(event) => {
                            event.stopPropagation();
                            void runFeed(feed);
                        }}
                    >
                        <Play className="w-3.5 h-3.5" />
                        Run now
                    </button>
                ) : null,
        },
    ];

    const runCols: Column<TiRun>[] = [
        {
            key: 'feed',
            header: 'Source',
            render: (run) => (
                <span className="text-xs">
                    {FEED_NAME[run.feed_id] ?? run.feed_id}
                </span>
            ),
        },
        {
            key: 'at',
            header: 'Started',
            render: (run) => (
                <span className="text-[11px] text-foreground-muted">
                    {fmtWat(run.started_at)}
                </span>
            ),
            sort: (run) => run.started_at,
        },
        {
            key: 'status',
            header: 'Result',
            render: (run) => (
                <StatusPill
                    tone={
                        run.status === 'ok'
                            ? 'good'
                            : run.status === 'failed'
                              ? 'critical'
                              : 'neutral'
                    }
                    label={run.status}
                />
            ),
        },
        {
            key: 'counts',
            header: 'Counts',
            render: (run) => (
                <span className="text-[11px] tabular-nums text-foreground-muted">
                    {run.fetched} / {run.new} new / {run.updated} upd /{' '}
                    {run.duplicates} dup / {run.invalid} inv
                </span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'error',
            header: 'Error',
            render: (run) => (
                <span className="text-[11px] text-red">
                    {run.error?.slice(0, 120) ?? ''}
                </span>
            ),
            hideBelow: 'lg',
        },
    ];

    const clientCols: Column<TaxiiClient>[] = [
        {
            key: 'name',
            header: 'Client',
            render: (client) => (
                <span className="text-xs font-semibold">{client.name}</span>
            ),
        },
        {
            key: 'user',
            header: 'Username',
            render: (client) => (
                <span className="font-mono text-[11px]">
                    {client.key_id}
                </span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'cols',
            header: 'Collections',
            render: (client) => (
                <span className="text-[11px]">
                    {client.collections
                        .map(
                            (id) =>
                                d?.exchange.collections.find(
                                    (collection) => collection.id === id,
                                )?.alias ?? id,
                        )
                        .join(', ')}
                </span>
            ),
            hideBelow: 'lg',
        },
        {
            key: 'tlp',
            header: 'Up to',
            render: (client) => <TlpBadge tlp={client.max_tlp} />,
        },
        {
            key: 'used',
            header: 'Last used',
            render: (client) => (
                <span className="text-[11px] text-foreground-muted">
                    {ago(client.last_used_at, now)}
                </span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'state',
            header: 'State',
            render: (client) =>
                client.revoked_at ? (
                    <StatusPill tone="neutral" label="Revoked" />
                ) : (
                    <StatusPill tone="good" label="Active" />
                ),
        },
        {
            key: 'x',
            header: '',
            render: (client) =>
                !client.revoked_at ? (
                    <button
                        type="button"
                        className={btn('ghost')}
                        onClick={(event) => {
                            event.stopPropagation();
                            setRevoke(client);
                        }}
                    >
                        Revoke
                    </button>
                ) : null,
        },
    ];

    const mispCheck = check ?? d?.misp.last_check ?? null;

    return (
        <div className="space-y-5">
            <PageHeader
                title="Sources & Intelligence Exchange"
                icon={Radio}
                description="Where the intelligence comes from, how fresh it is, how it is marked, and how partners receive it over TAXII 2.1."
            />

            <Notice msg={msg} />

            {src.load.state === 'error' ? (
                <ErrorState
                    error={src.load.error}
                    status={src.load.status}
                    onRetry={src.reload}
                />
            ) : !d ? (
                <Skeleton className="h-64" />
            ) : (
                <>
                    <Card>
                        <SectionTitle
                            title={`Threat Sources (${displayFeeds.length})`}
                            hint="The list combines available API records with the frontend catalogue. Missing integrations are shown as not configured."
                        />

                        <DataTable
                            caption="Threat Sources"
                            rows={displayFeeds}
                            columns={feedCols}
                            rowKey={(feed) => feed.id}
                        />
                    </Card>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <Card>
                            <SectionTitle title="Enrichment" />

                            <dl className="grid grid-cols-1 gap-3">
                                <Field label="NVD (CVSS, descriptions)">
                                    {d.enrichment.nvd.last_fetch
                                        ? `${ago(
                                              d.enrichment.nvd.last_fetch,
                                              now,
                                          )} · ${nf.format(
                                              d.enrichment.nvd.cves_tracked,
                                          )} CVEs tracked`
                                        : 'never fetched'}
                                    {!d.enrichment.nvd.configured_key
                                        ? ' · no NVD_API_KEY (slower rate limit)'
                                        : ''}
                                </Field>

                                <Field label="EPSS (FIRST)">
                                    {d.enrichment.epss.last_fetch
                                        ? ago(d.enrichment.epss.last_fetch, now)
                                        : 'never fetched'}
                                </Field>
                            </dl>
                        </Card>

                        <Card>
                            <SectionTitle
                                title="MISP"
                                action={
                                    manager ? (
                                        <button
                                            type="button"
                                            className={btn('secondary')}
                                            disabled={
                                                busy === 'misp' ||
                                                !d.misp.configured
                                            }
                                            onClick={() => void checkMisp()}
                                        >
                                            Check capabilities
                                        </button>
                                    ) : undefined
                                }
                            />

                            <dl className="grid grid-cols-2 gap-3">
                                <Field label="Connection">
                                    {d.misp.configured
                                        ? 'configured'
                                        : 'not configured (MISP_URL, MISP_API_KEY)'}
                                </Field>

                                <Field label="Writes from NCC SOC">
                                    {d.misp.writes_enabled ? (
                                        <span className="text-orange font-semibold">
                                            enabled
                                        </span>
                                    ) : (
                                        'off (read-only)'
                                    )}
                                </Field>

                                {mispCheck && (
                                    <>
                                        <Field label="Version">
                                            {mispCheck.version ??
                                                (mispCheck.reachable
                                                    ? 'unknown'
                                                    : 'unreachable')}
                                        </Field>

                                        <Field label="Key can write">
                                            {mispCheck.key_can_write === null
                                                ? 'unknown'
                                                : mispCheck.key_can_write
                                                  ? (
                                                        <span className="text-orange font-semibold">
                                                            yes — use a
                                                            read-only key
                                                        </span>
                                                    )
                                                  : 'no (read-only)'}
                                        </Field>

                                        <Field label="STIX 2 export">
                                            {mispCheck.stix2_export}
                                        </Field>

                                        <Field label="TAXII 2.1">
                                            {mispCheck.taxii21}
                                        </Field>

                                        <Field label="Checked">
                                            {fmtWat(mispCheck.checked_at)}
                                        </Field>

                                        {mispCheck.errors.length > 0 && (
                                            <Field label="Errors">
                                                {mispCheck.errors
                                                    .join('; ')
                                                    .slice(0, 200)}
                                            </Field>
                                        )}
                                    </>
                                )}
                            </dl>
                        </Card>

                        <Card>
                            <SectionTitle title="AI analyst" />

                            <dl className="grid grid-cols-2 gap-3">
                                <Field label="Provider">
                                    {d.ai.provider === 'ollama'
                                        ? 'Ollama (self-hosted)'
                                        : 'NVIDIA (external)'}
                                </Field>

                                <Field label="Model">{d.ai.model}</Field>

                                <Field label="State">
                                    {d.ai.configured ? (
                                        d.ai.reachable ? (
                                            <StatusPill
                                                tone="good"
                                                label="Reachable"
                                            />
                                        ) : (
                                            <StatusPill
                                                tone="critical"
                                                label="Unreachable"
                                            />
                                        )
                                    ) : (
                                        <StatusPill
                                            tone="neutral"
                                            label="Not configured"
                                        />
                                    )}
                                </Field>

                                <Field label="Detail">{d.ai.detail}</Field>
                            </dl>

                            <p className="text-[11px] text-foreground-muted mt-2">
                                {d.ai.provider === 'ollama'
                                    ? "The platform's own model may read records up to TLP:AMBER+STRICT; never TLP:RED."
                                    : 'An external provider receives only TLP:CLEAR and TLP:GREEN records.'}
                            </p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <Card>
                            <SectionTitle
                                title="Source records by marking"
                                hint="Exports carry only what the marking allows"
                            />

                            <BarList
                                label="Source records by TLP"
                                items={(
                                    Object.keys(TLP_LABEL) as Tlp[]
                                ).map((tlp) => ({
                                    key: tlp,
                                    label: TLP_LABEL[tlp],
                                    value:
                                        d.sharing.source_records_by_tlp[tlp] ??
                                        0,
                                    token:
                                        tlp === 'red'
                                            ? '--vz-critical'
                                            : tlp === 'amber' ||
                                                tlp === 'amber+strict'
                                              ? '--vz-warning'
                                              : tlp === 'green'
                                                ? '--vz-good'
                                                : '--vz-neutral',
                                }))}
                            />
                        </Card>

                        <Card className="xl:col-span-2">
                            <SectionTitle
                                title="TAXII 2.1 exchange"
                                hint="Read-only, per-client credentials, shared intelligence only"
                            />

                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Discovery">
                                    <span className="font-mono">
                                        {d.exchange.taxii_discovery}
                                    </span>

                                    <button
                                        type="button"
                                        className={btn('ghost')}
                                        onClick={() =>
                                            copy(d.exchange.taxii_discovery)
                                        }
                                        aria-label="Copy discovery URL"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </Field>

                                <Field label="API root">
                                    <span className="font-mono">
                                        {d.exchange.api_root}
                                    </span>
                                </Field>
                            </dl>

                            <ul className="mt-3 space-y-2">
                                {d.exchange.collections.map((collection) => (
                                    <li
                                        key={collection.id}
                                        className="rounded-xl border border-border p-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs font-semibold">
                                                {collection.title}{' '}
                                                <span className="font-mono text-[10px] text-foreground-muted">
                                                    {collection.id}
                                                </span>
                                            </p>

                                            <span className="flex gap-1">
                                                {(
                                                    ['clear', 'green'] as const
                                                ).map((tlp) => (
                                                    <button
                                                        key={tlp}
                                                        type="button"
                                                        className={btn(
                                                            'secondary',
                                                        )}
                                                        disabled={
                                                            !!busy ||
                                                            !can.manage
                                                        }
                                                        onClick={() =>
                                                            void download(
                                                                collection.alias,
                                                                tlp,
                                                            )
                                                        }
                                                        title={`STIX 2.1 bundle at ${TLP_LABEL[tlp]}`}
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        {TLP_LABEL[tlp]}
                                                    </button>
                                                ))}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-foreground-muted mt-1">
                                            {collection.description}
                                        </p>
                                    </li>
                                ))}
                            </ul>

                            <details className="mt-3 text-[11px] text-foreground-muted">
                                <summary className="cursor-pointer font-semibold text-foreground">
                                    Connecting a consumer
                                </summary>

                                <div className="mt-2 space-y-1.5">
                                    <p>
                                        Use any TAXII 2.1 client with HTTP Basic
                                        authentication: the username and
                                        password issued below. Every request
                                        needs{' '}
                                        <span className="font-mono">
                                            Accept:
                                            application/taxii+json;version=2.1
                                        </span>
                                        .
                                    </p>

                                    <pre className="rounded-lg bg-card-muted p-2 overflow-x-auto font-mono text-[10px]">
{`from taxii2client.v21 import Server, as_pages
server = Server("${d.exchange.taxii_discovery}", user="<username>", password="<password>")
col = server.default.collections[0]
for page in as_pages(col.get_objects, per_request=100, added_after="2026-01-01T00:00:00Z"):
    ...`}
                                    </pre>

                                    <p>
                                        Poll with{' '}
                                        <span className="font-mono">
                                            added_after
                                        </span>{' '}
                                        set to the last{' '}
                                        <span className="font-mono">
                                            X-TAXII-Date-Added-Last
                                        </span>{' '}
                                        you received: changed objects come back
                                        with a new version. Collections are
                                        read-only.
                                    </p>
                                </div>
                            </details>
                        </Card>
                    </div>

                    {manager && (
                        <Card>
                            <SectionTitle
                                title="TAXII clients"
                                hint="Each partner gets its own credentials, collections and TLP ceiling"
                            />

                            {clients.load.state === 'error' ? (
                                <ErrorState
                                    error={clients.load.error}
                                    status={clients.load.status}
                                    onRetry={clients.reload}
                                />
                            ) : (
                                <DataTable
                                    caption="TAXII clients"
                                    rows={clients.data?.clients ?? null}
                                    columns={clientCols}
                                    rowKey={(client) => client.id}
                                    empty={
                                        <EmptyState
                                            compact
                                            title="No clients yet"
                                            body="Create one below for each partner that should receive intelligence."
                                        />
                                    }
                                />
                            )}

                            <form
                                className="mt-4 flex flex-wrap items-end gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void createClient();
                                }}
                            >
                                <label className="text-[11px] font-semibold flex flex-col gap-1">
                                    Partner name
                                    <input
                                        value={name}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                        maxLength={120}
                                        className="text-xs rounded-lg border border-border bg-card px-2 py-1.5 min-w-[200px]"
                                    />
                                </label>

                                <fieldset className="text-[11px] flex flex-wrap gap-2 items-center">
                                    <legend className="font-semibold mb-1">
                                        Collections
                                    </legend>

                                    {d.exchange.collections.map(
                                        (collection) => (
                                            <label
                                                key={collection.id}
                                                className="flex items-center gap-1"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={cols.includes(
                                                        collection.id,
                                                    )}
                                                    onChange={(event) =>
                                                        setCols((current) =>
                                                            event.target.checked
                                                                ? [
                                                                      ...current,
                                                                      collection.id,
                                                                  ]
                                                                : current.filter(
                                                                      (id) =>
                                                                          id !==
                                                                          collection.id,
                                                                  ),
                                                        )
                                                    }
                                                />
                                                {collection.alias}
                                            </label>
                                        ),
                                    )}
                                </fieldset>

                                <label className="text-[11px] font-semibold flex flex-col gap-1">
                                    Up to
                                    <select
                                        value={maxTlp}
                                        onChange={(event) =>
                                            setMaxTlp(
                                                event.target.value as
                                                    | 'clear'
                                                    | 'green'
                                                    | 'amber',
                                            )
                                        }
                                        className="text-xs rounded-lg border border-border bg-card px-2 py-1.5"
                                    >
                                        <option value="clear">
                                            TLP:CLEAR
                                        </option>
                                        <option value="green">
                                            TLP:GREEN
                                        </option>
                                        <option value="amber">
                                            TLP:AMBER (named partners)
                                        </option>
                                    </select>
                                </label>

                                <button
                                    type="submit"
                                    className={btn('primary')}
                                    disabled={
                                        busy === 'client' ||
                                        name.trim().length < 2 ||
                                        !cols.length
                                    }
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Create credentials
                                </button>
                            </form>

                            {creds && (
                                <div className="mt-3 rounded-xl border border-orange/40 bg-orange/10 p-3 text-xs">
                                    <p className="font-semibold">
                                        Credentials for {creds.name} — shown
                                        once. Store them now.
                                    </p>

                                    <p className="mt-1 font-mono break-all">
                                        username: {creds.username}{' '}
                                        <button
                                            type="button"
                                            className={btn('ghost')}
                                            onClick={() =>
                                                copy(creds.username)
                                            }
                                            aria-label="Copy username"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </p>

                                    <p className="font-mono break-all">
                                        password: {creds.password}{' '}
                                        <button
                                            type="button"
                                            className={btn('ghost')}
                                            onClick={() =>
                                                copy(creds.password)
                                            }
                                            aria-label="Copy password"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </p>

                                    <button
                                        type="button"
                                        className={`${btn('secondary')} mt-2`}
                                        onClick={() => setCreds(null)}
                                    >
                                        I have stored them
                                    </button>
                                </div>
                            )}
                        </Card>
                    )}

                    <Card>
                        <SectionTitle title="Recent runs" />

                        <DataTable
                            caption="Recent runs"
                            rows={d.runs}
                            columns={runCols}
                            rowKey={(run) => run.id}
                            pageSize={15}
                            initialSort={{ key: 'at', dir: 'desc' }}
                            empty={
                                <EmptyState
                                    compact
                                    title="No runs yet"
                                    body="Feeds run on the host that owns scheduled jobs."
                                />
                            }
                        />
                    </Card>
                </>
            )}

            <ConfirmDialog
                open={!!revoke}
                title={`Revoke ${revoke?.name ?? ''}?`}
                body="Its credentials stop working immediately. This cannot be undone; issue new credentials if the partner needs access again."
                confirmLabel="Revoke"
                tone="danger"
                onConfirm={() =>
                    revoke ? doRevoke(revoke) : undefined
                }
                onCancel={() => setRevoke(null)}
            />
        </div>
    );
}
