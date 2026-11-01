'use client';

// Collector Management (P1) — virtual collectors are simulation records, not real executable
// agents. Every collector persists in the simulation state (src/lib/simulation/engine.ts) and
// progresses through its lifecycle on the shared simulation clock (src/lib/simulation/
// scheduler.ts), not a client-side timer. Creating one here, or completing the onboarding
// wizard's walkthrough, both write to the same collectors list.

import { useState } from 'react';
import { Plus, Radio, Pause, Play, Trash2, RefreshCw, Check, ArrowLeft, ArrowRight, Server, Laptop, Network, Flame, Cloud, Database } from 'lucide-react';
import { PageHeader, KpiCard, btn, EmptyState, ErrorState, Notice, Drawer, ConfirmDialog, Timeline, type Msg } from './vms/kit';
import { Card, SectionTitle, StatusPill, type Tone } from './vms/ui';
import { DataTable, type Column } from './vms/table';
import { useVmsData, vmsSend } from './vms/data';
import { relTime } from '@/lib/vmsFormat';

type CollectorStatus = 'created' | 'configuring' | 'connecting' | 'validating' | 'collecting' | 'operational' | 'paused' | 'error';
interface Collector {
    id: string; name: string; collectorKind: string; infraCategory: string; orgId: string; businessUnit: string; assetScope: string;
    collectionIntervalMinutes: number; status: CollectorStatus; statusHistory: { at: string; status: CollectorStatus; note?: string }[];
    lastHeartbeat: string | null; lastSync: string | null; assetsDiscovered: number; eventsCollected: number; health: 'healthy' | 'degraded' | 'down';
    errorMessage: string | null; createdAt: string;
}
interface Org { id: string; name: string; domain: string; businessUnits?: string[] }
interface IngestionEvent { id: string; at: string; assetCategory: string; eventType: string; processingState: string; assetId: string | null }

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
const CATEGORY_OPTIONS: [string, string, typeof Server][] = [
    ['servers', 'Servers', Server], ['middleware', 'WebLogic / Middleware', Database], ['cloud', 'Cloud', Cloud],
    ['endpoints', 'Endpoints', Laptop], ['dev_workstations', 'Developer Workstations', Laptop], ['network', 'Network', Network], ['firewall', 'Firewalls', Flame],
];
/** Which collection methods make sense for the chosen infrastructure — Step 2 only offers these. */
const METHODS_FOR_CATEGORY: Record<string, string[]> = {
    servers: ['agentless', 'endpoint', 'vuln_assessment'], middleware: ['log_forwarding', 'agentless'], cloud: ['api_connector'],
    endpoints: ['endpoint'], dev_workstations: ['endpoint'], network: ['network_telemetry'], firewall: ['network_telemetry'],
};
const DEPLOYMENT_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
    endpoint: { title: 'Agent-Based Collection', steps: ['Install the collector agent package on each in-scope host.', 'Register the agent with this organisation\'s collector endpoint.', 'Select the telemetry categories to forward (auth, process, file integrity).', 'Confirm the agent appears as connected in this dashboard.'] },
    agentless: { title: 'Agentless Discovery', steps: ['Provide read-only network reachability to the target range.', 'Configure discovery to run on the chosen interval.', 'Review discovered hosts before they are added to the inventory.', 'No software is installed on target systems.'] },
    network_telemetry: { title: 'Log / Syslog Forwarding', steps: ['Configure the device to forward supported logs to the organisation-approved collector endpoint.', 'Select the expected log format (syslog, CEF, or vendor-specific).', 'Configure secure transport (TLS) where the device supports it.', 'Validate delivery with a test event.', 'Confirm records appear in the collection dashboard.'] },
    api_connector: { title: 'Cloud API Connector', steps: ['Create a read-only API role or service account in the cloud provider.', 'Provide the role\'s identifier to the connector configuration (no secrets are stored in this preview).', 'Select which services to poll (compute, storage, identity).', 'Confirm the connector reports a successful poll cycle.'] },
    log_forwarding: { title: 'Log Forwarding Integration', steps: ['Point the application\'s log output at the organisation-approved forwarding endpoint.', 'Select the log format and the fields to normalise.', 'Validate that a sample log line is received and parsed correctly.', 'Confirm the integration appears as active.'] },
    vuln_assessment: { title: 'Vulnerability Assessment Integration', steps: ['Define the asset scope this connector may assess.', 'Select the assessment profile (discovery, port scan, vulnerability scan).', 'Confirm the scope is authorised before any assessment runs.', 'Review the first assessment result once available.'] },
};
const VALIDATION_STEPS = ['Configuration reviewed', 'Endpoint validation scenario', 'Sample telemetry received', 'Event normalization completed', 'Collector registered'];

const inputCls = 'w-full mt-1 border border-border bg-card-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple text-foreground';
const labelCls = 'text-xs font-medium text-foreground-muted uppercase tracking-wide';
const WIZARD_STEPS = ['Infrastructure', 'Method', 'Configure', 'Deployment', 'Validate', 'Done'];

function CreateCollectorWizard({ orgs, onCreated, onCancel }: { orgs: Org[]; onCreated: () => void; onCancel: () => void }) {
    const [step, setStep] = useState(0);
    const [category, setCategory] = useState<string | null>(null);
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

    const methods = category ? METHODS_FOR_CATEGORY[category] ?? [] : [];
    const canAdvance = step === 0 ? !!category : step === 1 ? !!kind : step === 2 ? name.trim().length > 0 && !!orgId : true;

    const runValidation = () => {
        setValidated(0);
        VALIDATION_STEPS.forEach((_, i) => setTimeout(() => setValidated(i + 1), (i + 1) * 500));
    };

    const submit = async () => {
        if (!name.trim() || !orgId || !kind || !category) { setError('Name, organisation, method and infrastructure are required.'); return; }
        setBusy(true);
        setError(null);
        const r = await vmsSend('POST', '/api/collectors', {
            name: name.trim(), org_id: orgId, collector_kind: kind, infra_category: category,
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
                <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_OPTIONS.map(([id, label, Icon]) => (
                        <button key={id} onClick={() => { setCategory(id); setKind(null); }} className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-[11px] font-semibold transition-colors ${category === id ? 'border-purple bg-purple/5 text-purple' : 'border-border text-foreground-muted hover:border-purple/40'}`}>
                            <Icon size={18} /> {label}
                        </button>
                    ))}
                </div>
            )}

            {step === 1 && (
                <div className="space-y-2">
                    <p className="text-xs text-foreground-muted">Collection methods appropriate for {CATEGORY_OPTIONS.find(([id]) => id === category)?.[1]}:</p>
                    {methods.map((m) => (
                        <button key={m} onClick={() => setKind(m)} className={`w-full text-left rounded-lg border p-3 text-xs font-semibold transition-colors ${kind === m ? 'border-purple bg-purple/5 text-purple' : 'border-border text-foreground-muted hover:border-purple/40'}`}>
                            {KIND_OPTIONS.find(([v]) => v === m)?.[1] ?? m}
                        </button>
                    ))}
                </div>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <div><label className={labelCls}>Collector name *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-servers-collector" className={inputCls} /></div>
                    <div><label className={labelCls}>Organisation *</label>
                        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputCls}>
                            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>
                    <div><label className={labelCls}>Business unit / asset group</label><input value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} placeholder="e.g. Platform" className={inputCls} /></div>
                    <div><label className={labelCls}>Asset scope</label><input value={assetScope} onChange={(e) => setAssetScope(e.target.value)} placeholder="e.g. Production subnet" className={inputCls} /></div>
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
                    <p className="text-[11px] text-foreground-muted">Simulated connection validation — not a real network check.</p>
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
                            <p className="text-sm font-bold text-foreground">{created.name} registered</p>
                            <p className="text-xs text-foreground-muted">It will progress through its connection lifecycle on the shared simulation clock and appear in the table below.</p>
                        </>
                    ) : busy ? <p className="text-xs text-foreground-muted">Registering collector…</p> : null}
                    {error && <p className="text-xs text-red font-semibold">{error}</p>}
                </div>
            )}

            {/* Sticky within the Drawer's scrolling body — stays pinned at the bottom of the
                visible area via `sticky`, so a tall step's actions are never scrolled out of view
                without needing the Drawer itself to know about wizard steps. */}
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

interface LinkedAsset { id: string; value: string; asset_type: string; criticality: string; discovery_sources: string[] }

function CollectorInspector({ collector, onClose, onChanged }: { collector: Collector; onClose: () => void; onChanged: () => void }) {
    const events = useVmsData<{ events: IngestionEvent[] }>(`/api/collectors/${collector.id}/events`);
    const assets = useVmsData<{ assets: LinkedAsset[] }>('/api/vms/assets');
    const linkedAssets = (assets.data?.assets ?? []).filter((a) => a.discovery_sources.includes(`collector:${collector.id}`));
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
                    ) : collector.status !== 'operational' ? (
                        <button onClick={() => void act('pause')} disabled={busy} className={btn('secondary')}><Pause className="w-3.5 h-3.5" aria-hidden /> Pause</button>
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
                <SectionTitle title="Associated assets" hint="Discovered by this collector once it reached Operational" />
                {linkedAssets.length === 0
                    ? <p className="text-xs text-foreground-muted">No assets discovered yet.</p>
                    : <ul className="space-y-1.5 text-xs">{linkedAssets.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="font-mono text-foreground">{a.value}</span><span className="text-foreground-muted capitalize">{a.criticality}</span></li>)}</ul>}
            </div>
            <div>
                <SectionTitle title="Status timeline" hint="Advances automatically on the simulation clock" />
                <Timeline empty="No status changes yet." items={collector.statusHistory.slice().reverse().map((h, i) => ({ id: `${collector.id}-${i}`, at: h.at, title: STATUS_LABEL[h.status], meta: new Date(h.at).toLocaleTimeString(), body: h.note ?? null, tone: h.status === 'error' ? 'critical' : h.status === 'operational' ? 'good' : undefined }))} />
            </div>
            <div>
                <SectionTitle title="Recent ingestion events" />
                {events.load.state === 'error' ? <ErrorState error={events.load.error} status={events.load.status} /> : (
                    (events.data?.events.length ?? 0) === 0
                        ? <p className="text-xs text-foreground-muted">No events ingested yet — events appear once this collector reaches "Operational".</p>
                        : <ul className="space-y-1.5 text-xs">{events.data!.events.slice(0, 15).map((e) => <li key={e.id} className="flex justify-between gap-2 text-foreground-muted"><span>{e.eventType.replace(/_/g, ' ')} · {e.assetCategory}</span><span>{relTime(e.at, Date.now())}</span></li>)}</ul>
                )}
            </div>
            <ConfirmDialog open={confirmRemove} title="Remove this collector?" body={<>This stops collection for <b>{collector.name}</b>. Assets it already discovered remain in the inventory.</>} confirmLabel="Remove" tone="danger" onCancel={() => setConfirmRemove(false)} onConfirm={remove} />
        </div>
    );
}

export function CollectorManagement() {
    const collectors = useVmsData<{ collectors: Collector[] }>('/api/collectors');
    const orgs = useVmsData<{ organisations: Org[] }>('/api/organisations');
    const [showCreate, setShowCreate] = useState(false);
    const [inspect, setInspect] = useState<Collector | null>(null);
    const [msg, setMsg] = useState<Msg>(null);

    const rows = collectors.data?.collectors ?? null;
    const orgName = (id: string) => orgs.data?.organisations.find((o) => o.id === id)?.name ?? id;
    const operational = rows?.filter((c) => c.status === 'operational').length ?? 0;
    const inProgress = rows?.filter((c) => !['operational', 'paused', 'error'].includes(c.status)).length ?? 0;
    const errored = rows?.filter((c) => c.status === 'error').length ?? 0;

    const columns: Column<Collector>[] = [
        { key: 'name', header: 'Collector', className: 'min-w-[180px]', sort: (c) => c.name, render: (c) => <div><p className="font-semibold text-foreground">{c.name}</p><p className="text-[10.5px] text-foreground-muted">{c.collectorKind.replace(/_/g, ' ')}</p></div> },
        { key: 'category', header: 'Infrastructure', render: (c) => <span className="text-[11px]">{CATEGORY_OPTIONS.find(([v]) => v === c.infraCategory)?.[1] ?? c.infraCategory}</span> },
        { key: 'org', header: 'Organisation', hideBelow: 'md', render: (c) => <span className="text-[11px] text-foreground-muted">{orgName(c.orgId)}</span> },
        { key: 'status', header: 'Status', sort: (c) => c.status, render: (c) => <StatusPill tone={STATUS_TONE[c.status]} label={STATUS_LABEL[c.status]} /> },
        { key: 'heartbeat', header: 'Last heartbeat', hideBelow: 'lg', sort: (c) => c.lastHeartbeat ?? '', render: (c) => <span className="text-[11px] text-foreground-muted">{c.lastHeartbeat ? relTime(c.lastHeartbeat, Date.now()) : '—'}</span> },
        { key: 'assets', header: 'Assets found', sort: (c) => c.assetsDiscovered, render: (c) => <span className="tabular-nums font-semibold">{c.assetsDiscovered}</span> },
        { key: 'events', header: 'Events', hideBelow: 'md', sort: (c) => c.eventsCollected, render: (c) => <span className="tabular-nums text-foreground-muted">{c.eventsCollected}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={Radio} title="Collector Management" description="Virtual collectors — simulation records that progress through a connection lifecycle on the shared simulation clock and, once operational, discover fictional assets into the inventory. No real agent is ever installed or connected."
                actions={<>
                    <button onClick={() => collectors.reload()} className={btn('secondary', 'md')}><RefreshCw className="w-3.5 h-3.5" aria-hidden /> Refresh</button>
                    <button onClick={() => setShowCreate(true)} className={btn('primary', 'md')}><Plus className="w-3.5 h-3.5" aria-hidden /> Create Collector</button>
                </>} />
            <Notice msg={msg} />
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total collectors" value={rows?.length} />
                <KpiCard label="Operational" value={operational} tone="good" />
                <KpiCard label="In progress" value={inProgress} tone="warning" />
                <KpiCard label="Error" value={errored} tone={errored > 0 ? 'critical' : 'neutral'} />
            </section>
            {collectors.load.state === 'error' ? <ErrorState error={collectors.load.error} status={collectors.load.status} onRetry={collectors.reload} /> : (
                <DataTable caption="Collectors" rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={setInspect} initialSort={{ key: 'heartbeat', dir: 'desc' }}
                    empty={<EmptyState icon={Radio} title="No collectors yet" body="Create a collector to start simulated asset discovery for an organisation." action={<button onClick={() => setShowCreate(true)} className={btn('primary', 'md')}>Create Collector</button>} />} />
            )}
            <Drawer open={showCreate} onClose={() => setShowCreate(false)} title="Create Collector">
                <CreateCollectorWizard orgs={orgs.data?.organisations ?? []} onCancel={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setMsg({ ok: true, text: 'Collector created — it will begin connecting on the next simulation tick.' }); collectors.reload(); }} />
            </Drawer>
            <Drawer open={!!inspect} onClose={() => setInspect(null)} title={inspect?.name ?? ''} subtitle="Collector detail">
                {inspect && <CollectorInspector collector={rows?.find((c) => c.id === inspect.id) ?? inspect} onClose={() => setInspect(null)} onChanged={() => collectors.reload()} />}
            </Drawer>
        </div>
    );
}
