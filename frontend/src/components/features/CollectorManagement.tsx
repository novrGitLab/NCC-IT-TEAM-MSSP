'use client';

// Collector Management. Virtual collectors are platform records, not real executable agents. Every
// collector persists in the simulation state and progresses through its lifecycle on the shared
// platform clock. Each collector can be mapped to NCC critical infrastructure (Collector Mapping tab).

import { useState } from 'react';
import { Plus, Radio, Pause, Play, Trash2, RefreshCw, Check, ArrowLeft, ArrowRight, Download, Server, Laptop, Network, Flame, Cloud } from 'lucide-react';
import { NCC_INFRASTRUCTURE, nccInfrastructureById, type NccInfrastructureItem } from '@ncc-it/backend/contracts/ncc-infrastructure';
import { PageHeader, KpiCard, btn, EmptyState, ErrorState, Notice, Drawer, ConfirmDialog, Timeline, Segmented, type Msg } from './vms/kit';
import { Card, SectionTitle, StatusPill, type Tone } from './vms/ui';
import { DataTable, type Column } from './vms/table';
import { useVmsData, useVmsCan, vmsSend } from './vms/data';
import { CollectorMappingWorkspace, CollectorMappedInfrastructure } from './CollectorMappingWorkspace';
import { apiFetch, apiUrl } from '@/lib/api';
import { relTime } from '@/lib/vmsFormat';
import { fmtWat } from '@/lib/vms';

type CollectorStatus = 'created' | 'configuring' | 'connecting' | 'validating' | 'collecting' | 'operational' | 'paused' | 'error';
interface Collector {
    id: string; name: string; collectorKind: string; infraCategory: string; orgId: string; businessUnit: string; assetScope: string;
    collectionIntervalMinutes: number; status: CollectorStatus; statusHistory: { at: string; status: CollectorStatus; note?: string }[];
    lastHeartbeat: string | null; lastSync: string | null; assetsDiscovered: number; eventsCollected: number; health: 'healthy' | 'degraded' | 'down';
    errorMessage: string | null; createdAt: string;
}
interface Org { id: string; name: string; domain: string; businessUnits?: string[] }
interface IngestionEvent { id: string; at: string; assetCategory: string; eventType: string; processingState: string; assetId: string | null }
interface MappingRow { collectorId: string; infrastructureName: string }
interface AgentPackage { id: string; name: string; os: string; arch: string; file: string; version: string | null; available: boolean; reason: string | null }
interface AgentListing { packages: AgentPackage[]; availableCount: number; artifactDirectory: string }

const STATUS_LABEL: Record<CollectorStatus, string> = {
    created: 'Created', configuring: 'Configuring', connecting: 'Connecting', validating: 'Validating', collecting: 'Collecting',
    operational: 'Operational', paused: 'Paused', error: 'Error',
};
const STATUS_TONE: Record<CollectorStatus, Tone> = {
    created: 'neutral', configuring: 'warning', connecting: 'warning', validating: 'warning', collecting: 'warning',
    operational: 'good', paused: 'neutral', error: 'critical',
};
const KIND_OPTIONS: [string, string][] = [
    ['endpoint', 'Endpoint collector (agent-based)'], ['network_telemetry', 'Network telemetry / log forwarding'], ['api_connector', 'Cloud API connector'],
    ['log_forwarding', 'Log forwarding integration'], ['agentless', 'Agentless discovery'], ['vuln_assessment', 'Vulnerability assessment connector'],
];
/** Which collection methods make sense for each engine infrastructure category. */
const METHODS_FOR_CATEGORY: Record<string, string[]> = {
    servers: ['agentless', 'endpoint', 'vuln_assessment'], middleware: ['log_forwarding', 'agentless'], cloud: ['api_connector'],
    endpoints: ['endpoint'], dev_workstations: ['endpoint'], network: ['network_telemetry'], firewall: ['network_telemetry'],
};
const CATEGORY_ICON: Record<NccInfrastructureItem['engineCategory'], typeof Server> = { servers: Server, cloud: Cloud, endpoints: Laptop, network: Network, firewall: Flame };
const DEPLOYMENT_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
    endpoint: { title: 'Agent-Based Collection', steps: ['Install the collector agent package on each in-scope host.', 'Register the agent with this organisation\'s collector endpoint.', 'Select the telemetry categories to forward (auth, process, file integrity).', 'Confirm the agent appears as connected in this dashboard.'] },
    agentless: { title: 'Agentless Discovery', steps: ['Provide read-only network reachability to the target range.', 'Configure discovery to run on the chosen interval.', 'Review discovered hosts before they are added to the inventory.', 'No software is installed on target systems.'] },
    network_telemetry: { title: 'Log / Syslog Forwarding', steps: ['Configure the device to forward supported logs to the organisation-approved collector endpoint.', 'Select the expected log format (syslog, CEF, or vendor-specific).', 'Configure secure transport (TLS) where the device supports it.', 'Validate delivery with a test event.', 'Confirm records appear in the collection dashboard.'] },
    api_connector: { title: 'Cloud API Connector', steps: ['Create a read-only API role or service account in the cloud provider.', 'Provide the role\'s identifier to the connector configuration (no secrets are stored in this preview).', 'Select which services to poll (compute, storage, identity).', 'Confirm the connector reports a successful poll cycle.'] },
    log_forwarding: { title: 'Log Forwarding Integration', steps: ['Point the application\'s log output at the organisation-approved forwarding endpoint.', 'Select the log format and the fields to normalise.', 'Validate that a sample log line is received and parsed correctly.', 'Confirm the integration appears as active.'] },
    vuln_assessment: { title: 'Vulnerability Assessment Integration', steps: ['Define the asset scope this connector may assess.', 'Select the assessment profile (discovery, port scan, vulnerability scan).', 'Confirm the scope is authorised before any assessment runs.', 'Review the first assessment result once available.'] },
};
const VALIDATION_STEPS = ['Configuration reviewed', 'Endpoint validation scenario', 'Sample telemetry received', 'Event normalization completed', 'Collector registered'];
const WIZARD_STEPS = ['Infrastructure', 'Method', 'Configure', 'Deployment', 'Validate', 'Done'];

const inputCls = 'w-full mt-1 border border-border bg-card-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple text-foreground';
const labelCls = 'text-xs font-medium text-foreground-muted uppercase tracking-wide';

function CreateCollectorWizard({ orgs, onCreated, onCancel }: { orgs: Org[]; onCreated: () => void; onCancel: () => void }) {
    const [step, setStep] = useState(0);
    const [infraIds, setInfraIds] = useState<string[]>([]);
    const [kind, setKind] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [orgId, setOrgId] = useState(orgs[0]?.id ?? '');
    const [businessUnit, setBusinessUnit] = useState('');
    const [assetScope, setAssetScope] = useState('');
    const [interval, setInterval] = useState('15');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validated, setValidated] = useState<number>(-1);
    const [created, setCreated] = useState<{ name: string } | null>(null);

    const items = infraIds.map((id) => nccInfrastructureById(id)).filter((i): i is NccInfrastructureItem => !!i);
    // Methods that suit any of the selected items, in catalogue order, without repeats.
    const methods = [...new Set(items.flatMap((i) => METHODS_FOR_CATEGORY[i.engineCategory] ?? []))];
    const canAdvance = step === 0 ? items.length > 0 : step === 1 ? !!kind && methods.includes(kind) : step === 2 ? name.trim().length > 0 && !!orgId : true;
    const toggleItem = (id: string) => { setInfraIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])); setKind(null); };

    const runValidation = () => {
        setValidated(0);
        VALIDATION_STEPS.forEach((_, i) => setTimeout(() => setValidated(i + 1), (i + 1) * 500));
    };

    const submit = async () => {
        if (!name.trim() || !orgId || !kind || items.length === 0) { setError('Name, organisation, method and at least one infrastructure item are required.'); return; }
        setBusy(true);
        setError(null);
        const r = await vmsSend('POST', '/api/collectors', {
            name: name.trim(), org_id: orgId, collector_kind: kind, ncc_infrastructure_ids: items.map((i) => i.id),
            business_unit: businessUnit.trim(), asset_scope: assetScope.trim(), collection_interval_minutes: Number(interval) || 15,
        });
        setBusy(false);
        if (!r.ok) { setError(r.error); return; }
        setCreated({ name: name.trim() });
        setStep(5);
    };

    const advance = () => {
        const next = step + 1;
        setStep(next);
        if (next === 4) runValidation();
        if (next === 5) void submit();
    };

    return (
        <div className="space-y-5 pb-2">
            <div className="flex items-center gap-1">
                {WIZARD_STEPS.map((s, i) => (
                    <div key={s} className="flex items-center gap-1 flex-1">
                        <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${i === step ? 'bg-purple text-white' : i < step ? 'bg-green/15 text-green' : 'bg-card-muted text-foreground-muted'}`}>{i < step ? <Check size={11} /> : i + 1}</span>
                        {i < WIZARD_STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
                    </div>
                ))}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-muted">{WIZARD_STEPS[step]}</p>

            {step === 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-foreground-muted">Choose one or more NCC critical infrastructure items this collector will be responsible for. Quantities are from the NCC register.</p>
                    <p className="text-[11px] font-semibold text-foreground">{items.length} selected</p>
                    <div role="group" aria-label="NCC critical infrastructure" className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                        {NCC_INFRASTRUCTURE.map((i) => {
                            const Icon = CATEGORY_ICON[i.engineCategory];
                            const on = infraIds.includes(i.id);
                            return (
                                <button key={i.id} role="checkbox" aria-checked={on} onClick={() => toggleItem(i.id)}
                                    className={`w-full text-left flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${on ? 'border-purple bg-purple/5' : 'border-border hover:border-purple/40'}`}>
                                    <Icon size={16} className={`mt-0.5 shrink-0 ${on ? 'text-purple' : 'text-foreground-muted'}`} aria-hidden />
                                    <span className="min-w-0">
                                        <span className={`block text-xs font-semibold ${on ? 'text-purple' : 'text-foreground'}`}>{i.no}. {i.name}{i.quantity ? ` (${i.quantity})` : ''}</span>
                                        <span className="block text-[11px] text-foreground-muted">{i.type} · {i.hosting}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-2">
                    <p className="text-xs text-foreground-muted">Collection methods appropriate for {items.map((i) => i.name).join(', ')}:</p>
                    {methods.map((m) => (
                        <button key={m} onClick={() => setKind(m)} className={`w-full text-left rounded-lg border p-3 text-xs font-semibold transition-colors ${kind === m ? 'border-purple bg-purple/5 text-purple' : 'border-border text-foreground-muted hover:border-purple/40'}`}>
                            {KIND_OPTIONS.find(([v]) => v === m)?.[1] ?? m}
                        </button>
                    ))}
                </div>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <div><label className={labelCls}>Collector name *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. core-firewall-collector" className={inputCls} /></div>
                    <div><label className={labelCls}>Organisation *</label>
                        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputCls}>
                            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>
                    <div><label className={labelCls}>Business unit / asset group</label><input value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} placeholder="e.g. Core Networking" className={inputCls} /></div>
                    <div><label className={labelCls}>Asset scope</label><input value={assetScope} onChange={(e) => setAssetScope(e.target.value)} placeholder="e.g. Core network segment" className={inputCls} /></div>
                    <div><label className={labelCls}>Collection interval (minutes)</label><input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} className={inputCls} /></div>
                    <p className="text-[11px] text-foreground-muted">No real credentials or secrets are collected for this preview.</p>
                </div>
            )}

            {step === 3 && kind && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground">{DEPLOYMENT_INSTRUCTIONS[kind].title}</p>
                    <ol className="space-y-2 text-xs text-foreground-muted list-decimal pl-4">
                        {DEPLOYMENT_INSTRUCTIONS[kind].steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                    <p className="text-[11px] text-amber bg-amber/10 border border-amber/30 rounded-lg px-3 py-2">Illustrative deployment guidance only — no real endpoint, credential or command is issued from this preview.</p>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-2">
                    <p className="text-[11px] text-foreground-muted">Illustrative connection validation — not a real network check.</p>
                    {VALIDATION_STEPS.map((s, i) => (
                        <div key={s} className="flex items-center gap-2 text-xs">
                            {validated > i ? <Check size={14} className="text-green" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-border motion-safe:animate-pulse" />}
                            <span className={validated > i ? 'text-foreground' : 'text-foreground-muted'}>{s}</span>
                        </div>
                    ))}
                </div>
            )}

            {step === 5 && (
                <div className="text-center py-6 space-y-2">
                    {created ? (
                        <>
                            <div className="w-14 h-14 bg-green/10 rounded-full flex items-center justify-center mx-auto"><Check size={28} className="text-green" /></div>
                            <p className="text-sm font-bold text-foreground">{created.name} registered and mapped to {items.length} NCC infrastructure item{items.length === 1 ? '' : 's'}</p>
                            <p className="text-xs text-foreground-muted">It will progress through its simulated connection lifecycle on the platform clock. Once operational it reports a simulated asset for each mapped item, and those assets appear in Asset Inventory.</p>
                        </>
                    ) : busy ? <p className="text-xs text-foreground-muted">Registering collector…</p> : null}
                    {error && <p className="text-xs text-red font-semibold">{error}</p>}
                </div>
            )}

            <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-card border-t border-border flex items-center justify-between">
                {step === 5 ? (
                    <button onClick={() => (created ? onCreated() : onCancel())} className={`${btn('primary', 'md')} ml-auto`}>{created ? 'View Collectors' : 'Close'}</button>
                ) : (
                    <>
                        <button onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)} className={btn('ghost', 'md')}>{step === 0 ? 'Cancel' : <><ArrowLeft size={14} /> Back</>}</button>
                        <button onClick={advance} disabled={!canAdvance} className={btn('primary', 'md')}>{step === 4 ? 'Create Collector' : <>Next <ArrowRight size={14} /></>}</button>
                    </>
                )}
            </div>
        </div>
    );
}

interface LinkedAsset {
    id: string; value: string; asset_type: string; criticality: string; discovery_sources: string[]; status: string; last_seen: string; simulated?: boolean;
    ncc?: { name: string; type: string } | null; discovery?: { health: 'reporting' | 'not_reporting' } | null;
}

function CollectorInspector({ collector, onClose, onChanged }: { collector: Collector; onClose: () => void; onChanged: () => void }) {
    const events = useVmsData<{ events: IngestionEvent[] }>(`/api/collectors/${collector.id}/events`);
    const assets = useVmsData<{ assets: LinkedAsset[] }>('/api/vms/assets');
    const linkedAssets = (assets.data?.assets ?? []).filter((a) => a.discovery_sources.includes(`collector:${collector.id}`));
    const lastDiscovery = (events.data?.events ?? []).filter((e) => e.eventType === 'asset_discovered').reduce<string | null>((m, e) => (!m || e.at > m ? e.at : m), null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [busy, setBusy] = useState(false);

    const act = async (action: 'pause' | 'resume') => {
        setBusy(true);
        await vmsSend('PATCH', `/api/collectors/${collector.id}`, { action });
        setBusy(false);
        onChanged();
    };
    const remove = async () => {
        setConfirmRemove(false);
        await vmsSend('DELETE', `/api/collectors/${collector.id}`);
        onChanged();
        onClose();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <StatusPill tone={STATUS_TONE[collector.status]} label={STATUS_LABEL[collector.status]} />
                <div className="flex items-center gap-2">
                    {collector.status === 'paused' || collector.status === 'error' ? (
                        <button onClick={() => void act('resume')} disabled={busy} className={btn('primary')}><Play className="w-3.5 h-3.5" aria-hidden /> Resume</button>
                    ) : (
                        <button onClick={() => void act('pause')} disabled={busy} className={btn('secondary')}><Pause className="w-3.5 h-3.5" aria-hidden /> Pause</button>
                    )}
                    <button onClick={() => setConfirmRemove(true)} className={btn('danger')}><Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove</button>
                </div>
            </div>
            {collector.errorMessage && <p className="text-xs text-red bg-red/5 border border-red/30 rounded-lg px-3 py-2">{collector.errorMessage}</p>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><dt className="text-foreground-muted">Business unit</dt><dd className="text-foreground font-semibold">{collector.businessUnit || '—'}</dd></div>
                <div><dt className="text-foreground-muted">Asset scope</dt><dd className="text-foreground font-semibold">{collector.assetScope || '—'}</dd></div>
                <div><dt className="text-foreground-muted">Collection interval</dt><dd className="text-foreground font-semibold">{collector.collectionIntervalMinutes} min</dd></div>
                <div><dt className="text-foreground-muted">Health</dt><dd className="text-foreground font-semibold capitalize">{collector.health}</dd></div>
                <div><dt className="text-foreground-muted">Assets discovered</dt><dd className="text-foreground font-semibold">{collector.assetsDiscovered}</dd></div>
                <div><dt className="text-foreground-muted">Events collected</dt><dd className="text-foreground font-semibold">{collector.eventsCollected}</dd></div>
            </dl>
            <div>
                <SectionTitle title="NCC infrastructure" hint="The infrastructure this collector is assigned to" />
                <CollectorMappedInfrastructure collectorId={collector.id} onChanged={onChanged} />
            </div>
            <div>
                <SectionTitle title={`Associated assets (${linkedAssets.length})`} hint="Simulated assets this collector reports; only assets it discovered itself" />
                {lastDiscovery && <p className="text-[11px] text-foreground-muted mb-2">Last simulated discovery {fmtWat(lastDiscovery)}</p>}
                {linkedAssets.length === 0
                    ? <p className="text-xs text-foreground-muted">{collector.status === 'operational' ? 'No assets reported yet. Map NCC infrastructure to this collector to discover its assets.' : 'Assets are discovered once this collector reaches Operational.'}</p>
                    : (
                        <ul className="space-y-2 text-xs">
                            {linkedAssets.map((a) => (
                                <li key={a.id} className="border border-border rounded-lg p-2.5">
                                    <a href={`/admin/vms/assets/${a.id}`} className="font-mono font-semibold text-blue hover:underline break-all">{a.value}</a>
                                    {a.ncc && <p className="text-foreground">{a.ncc.name} · {a.ncc.type}</p>}
                                    <p className="text-foreground-muted">{a.simulated ? 'Simulated collector' : 'Collector discovery'} · {a.discovery?.health === 'reporting' ? 'reporting' : a.status === 'gone' ? 'gone' : 'not reporting'} · last seen {fmtWat(a.last_seen)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
            </div>
            <div>
                <SectionTitle title="Status timeline" hint="Advances automatically on the platform clock" />
                <Timeline empty="No status changes yet." items={collector.statusHistory.slice().reverse().map((h, i) => ({ id: `${collector.id}-${i}`, at: h.at, title: STATUS_LABEL[h.status], meta: new Date(h.at).toLocaleTimeString(), body: h.note ?? null, tone: h.status === 'error' ? 'critical' : h.status === 'operational' ? 'good' : undefined }))} />
            </div>
            <div>
                <SectionTitle title="Recent ingestion events" hint="Simulated events from the platform clock" />
                {events.load.state === 'error' ? <ErrorState error={events.load.error} status={events.load.status} /> : (
                    (events.data?.events.length ?? 0) === 0
                        ? <p className="text-xs text-foreground-muted">No events ingested yet — events appear once this collector reaches "Operational".</p>
                        : <ul className="space-y-1.5 text-xs">{events.data!.events.slice(0, 15).map((e) => <li key={e.id} className="flex justify-between gap-2 text-foreground-muted"><span>{e.eventType.replace(/_/g, ' ')} · {e.assetCategory}</span><span>{relTime(e.at, Date.now())}</span></li>)}</ul>
                )}
            </div>
            <ConfirmDialog open={confirmRemove} title="Remove this collector?" body={<>This stops collection for <b>{collector.name}</b>. Its NCC infrastructure mapping is removed too. Assets it already discovered remain in the inventory.</>} confirmLabel="Remove" tone="danger" onCancel={() => setConfirmRemove(false)} onConfirm={remove} />
        </div>
    );
}

/** Endpoint agent packages: lists what is offered, and starts a download only when verified packages exist. */
function EndpointAgentsPanel() {
    const can = useVmsCan();
    const canDownload = can.role === 'super_admin' || can.role === 'soc_manager';
    const listing = useVmsData<AgentListing>('/api/collectors/agents');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string; missing?: { id: string; file: string; reason: string | null }[] } | null>(null);

    async function download() {
        setBusy(true);
        setResult(null);
        try {
            const res = await apiFetch(apiUrl('/api/collectors/agents/download'), { method: 'POST' });
            if (res.ok) {
                const blob = await res.blob();
                const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'ncc-endpoint-agents.tar';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.click();
                URL.revokeObjectURL(url);
                const count = res.headers.get('X-Agent-Package-Count') ?? '?';
                setResult({ tone: 'ok', text: `Download completed: ${name} (${count} verified package(s), MANIFEST.json with SHA-256, INSTALL.txt). It was saved by this browser; nothing was installed on any endpoint. Copy it to the endpoint collector and check the checksums before installing.` });
                return;
            }
            const body = await res.json().catch(() => null);
            if (res.status === 409) {
                setResult({ tone: 'warn', text: body?.error ?? 'No approved endpoint agent packages are available.', missing: body?.missing ?? [] });
            } else {
                setResult({ tone: 'error', text: body?.error ?? `The download failed (HTTP ${res.status}). Nothing was downloaded.` });
            }
        } catch {
            setResult({ tone: 'error', text: 'Could not reach the server. Nothing was downloaded.' });
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                    <SectionTitle title="Endpoint agents" hint="Installation packages for endpoint collectors. Nothing is installed on any endpoint from this page." />
                    {listing.load.state === 'error' ? <p className="text-xs text-red">Could not load package status: {listing.load.error}</p>
                        : !listing.data ? <p className="text-xs text-foreground-muted">Checking package status…</p>
                            : listing.data.availableCount === 0
                                ? <p className="text-xs text-foreground-muted">No approved endpoint agent packages are staged yet ({listing.data.packages.length} supported targets listed).</p>
                                : <p className="text-xs text-foreground">{listing.data.availableCount} verified package(s) available.</p>}
                </div>
                <button onClick={() => void download()} disabled={busy || !canDownload} title={canDownload ? undefined : 'Only super admins and SOC managers can download agent packages'}
                    className={`${btn('primary', 'md')} shrink-0`}>
                    <Download className="w-3.5 h-3.5" aria-hidden /> {busy ? 'Preparing…' : 'Download All Agents'}
                </button>
            </div>
            {result && (
                <div role="status" className={`mt-3 text-xs rounded-lg border px-3 py-2 ${result.tone === 'ok' ? 'border-green/30 bg-green/10 text-green' : result.tone === 'warn' ? 'border-amber/30 bg-amber/10 text-foreground' : 'border-red/30 bg-red/10 text-red'}`}>
                    <p className="font-semibold">{result.text}</p>
                    {result.missing && result.missing.length > 0 && (
                        <ul className="mt-2 space-y-1 text-foreground-muted">
                            {result.missing.map((m) => <li key={m.id}><span className="font-mono">{m.file}</span> — {m.reason ?? 'not available'}</li>)}
                        </ul>
                    )}
                </div>
            )}
            {listing.data && listing.data.packages.length > 0 && (
                <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-foreground-muted">Supported package targets ({listing.data.packages.length})</summary>
                    <ul className="mt-2 space-y-1">
                        {listing.data.packages.map((p) => (
                            <li key={p.id} className="flex flex-wrap gap-x-2 text-foreground-muted">
                                <span className="font-mono text-foreground">{p.file}</span>
                                <span>{p.os} · {p.arch}</span>
                                <span>{p.available ? `v${p.version}` : (p.reason ?? 'not available')}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </Card>
    );
}

type Tab = 'collectors' | 'mapping';

export function CollectorManagement() {
    const collectors = useVmsData<{ collectors: Collector[] }>('/api/collectors');
    const orgs = useVmsData<{ organisations: Org[] }>('/api/organisations');
    const mappings = useVmsData<{ rows: MappingRow[] }>('/api/collectors/mappings');
    const [tab, setTab] = useState<Tab>('collectors');
    const [showCreate, setShowCreate] = useState(false);
    const [inspect, setInspect] = useState<Collector | null>(null);
    const [msg, setMsg] = useState<Msg>(null);

    const rows = collectors.data?.collectors ?? null;
    const orgName = (id: string) => orgs.data?.organisations.find((o) => o.id === id)?.name ?? id;
    const infraFor = (collectorId: string) => {
        const names = (mappings.data?.rows ?? []).filter((r) => r.collectorId === collectorId).map((r) => r.infrastructureName);
        return names.length ? names.join(', ') : 'Not mapped';
    };
    const operational = rows?.filter((c) => c.status === 'operational').length ?? 0;
    const inProgress = rows?.filter((c) => !['operational', 'paused', 'error'].includes(c.status)).length ?? 0;
    const errored = rows?.filter((c) => c.status === 'error').length ?? 0;

    const columns: Column<Collector>[] = [
        { key: 'name', header: 'Collector', className: 'min-w-[180px]', sort: (c) => c.name, render: (c) => <div><p className="font-semibold text-foreground">{c.name}</p><p className="text-[10.5px] text-foreground-muted">{c.collectorKind.replace(/_/g, ' ')}</p></div> },
        { key: 'infra', header: 'NCC infrastructure', className: 'min-w-[160px]', render: (c) => <span className="text-[11px]">{infraFor(c.id)}</span> },
        { key: 'org', header: 'Organisation', hideBelow: 'md', render: (c) => <span className="text-[11px] text-foreground-muted">{orgName(c.orgId)}</span> },
        { key: 'status', header: 'Status', sort: (c) => c.status, render: (c) => <StatusPill tone={STATUS_TONE[c.status]} label={STATUS_LABEL[c.status]} /> },
        { key: 'heartbeat', header: 'Last heartbeat', hideBelow: 'lg', sort: (c) => c.lastHeartbeat ?? '', render: (c) => <span className="text-[11px] text-foreground-muted">{c.lastHeartbeat ? relTime(c.lastHeartbeat, Date.now()) : 'Awaiting first heartbeat'}</span> },
        { key: 'assets', header: 'Assets found', sort: (c) => c.assetsDiscovered, render: (c) => <span className="tabular-nums font-semibold">{c.assetsDiscovered}</span> },
        { key: 'events', header: 'Events', hideBelow: 'md', sort: (c) => c.eventsCollected, render: (c) => <span className="tabular-nums text-foreground-muted">{c.eventsCollected}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={Radio} title="Collector Management" description="Virtual collectors — platform records that progress through a connection lifecycle on the platform clock and, once operational, discover fictional assets into the inventory. No real agent is ever installed or connected."
                actions={<>
                    <button onClick={() => collectors.reload()} className={btn('secondary', 'md')}><RefreshCw className="w-3.5 h-3.5" aria-hidden /> Refresh</button>
                    <button onClick={() => setShowCreate(true)} className={btn('primary', 'md')}><Plus className="w-3.5 h-3.5" aria-hidden /> Create Collector</button>
                </>} />
            <Segmented label="Collector Management view" value={tab} onChange={setTab} options={[['collectors', 'Collectors'], ['mapping', 'Collector Mapping']]} />
            {tab === 'collectors' && <Notice msg={msg} />}

            {tab === 'collectors' ? (
                <>
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KpiCard label="Total collectors" value={rows?.length} />
                        <KpiCard label="Operational" value={operational} tone="good" />
                        <KpiCard label="In progress" value={inProgress} tone="warning" />
                        <KpiCard label="Error" value={errored} tone={errored > 0 ? 'critical' : 'neutral'} />
                    </section>
                    <EndpointAgentsPanel />
                    {collectors.load.state === 'error' ? <ErrorState error={collectors.load.error} status={collectors.load.status} onRetry={collectors.reload} /> : (
                        <DataTable caption="Collectors" rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={setInspect} initialSort={{ key: 'heartbeat', dir: 'desc' }}
                            empty={<EmptyState icon={Radio} title="No collectors yet" body="Create a collector to start illustrative asset discovery for an organisation." action={<button onClick={() => setShowCreate(true)} className={btn('primary', 'md')}>Create Collector</button>} />} />
                    )}
                </>
            ) : <CollectorMappingWorkspace />}

            <Drawer open={showCreate} onClose={() => setShowCreate(false)} title="Create Collector">
                <CreateCollectorWizard orgs={orgs.data?.organisations ?? []} onCancel={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setMsg({ ok: true, text: 'Collector created and mapped — it will begin connecting on the next platform tick.' }); collectors.reload(); mappings.reload(); }} />
            </Drawer>
            <Drawer open={!!inspect} onClose={() => setInspect(null)} title={inspect?.name ?? ''} subtitle="Collector detail">
                {inspect && <CollectorInspector collector={rows?.find((c) => c.id === inspect.id) ?? inspect} onClose={() => setInspect(null)} onChanged={() => { collectors.reload(); mappings.reload(); }} />}
            </Drawer>
        </div>
    );
}

