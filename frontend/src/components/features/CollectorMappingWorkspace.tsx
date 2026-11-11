'use client';

// Collector Mapping: which collectors are assigned to which NCC infrastructure, and what the platform
// has recorded about them. Status, heartbeat and data times come only from the collector's own recorded
// lifecycle (the platform clock); nothing here verifies a real device connection.

import { useMemo, useState } from 'react';
import { Link2, Pencil, Trash2, Plus, Search } from 'lucide-react';
import { NCC_INFRASTRUCTURE, nccInfrastructureById } from '@ncc-it/backend/contracts/ncc-infrastructure';
import { PageHeader, KpiCard, btn, EmptyState, ErrorState, Notice, Drawer, ConfirmDialog, type Msg } from './vms/kit';
import { Card, SectionTitle, StatusPill, type Tone } from './vms/ui';
import { DataTable, type Column } from './vms/table';
import { useVmsData, useVmsCan, vmsSend } from './vms/data';
import { fmtWat } from '@/lib/vms';

interface Connection {
    view: 'created' | 'registered' | 'connected' | 'stale' | 'offline' | 'error';
    label: string;
    lastHeartbeat: string | null;
    lastHeartbeatLabel: string;
    lastData: string | null;
    lastDataLabel: string;
}
interface MappingRow {
    mappingId: string; collectorId: string; collectorName: string; collectorKind: string;
    infrastructureId: string; infrastructureName: string; infrastructureType: string; hosting: string; quantity: number | null;
    connection: Connection; updatedAt: string; updatedBy: string;
    discoveredAsset: { id: string; name: string; at: string | null } | null;
    collectorAssetsDiscovered: number;
    collectorLastDiscovery: string | null;
}
interface UnmappedRow { collectorId: string; collectorName: string; collectorKind: string; connection: Connection }
interface MappingResponse { rows: MappingRow[]; unmapped: UnmappedRow[]; simulated: true }
interface CollectorOption { id: string; name: string }

const TONE: Record<Connection['view'], Tone> = { connected: 'good', registered: 'warning', stale: 'warning', created: 'neutral', offline: 'neutral', error: 'critical' };
const STATUS_OPTIONS: [string, string][] = [['connected', 'Connected'], ['registered', 'Registered'], ['created', 'Created'], ['stale', 'Stale'], ['offline', 'Offline'], ['error', 'Error']];
const TYPE_OPTIONS = [...new Set(NCC_INFRASTRUCTURE.map((i) => i.type))];
const inputCls = 'w-full border border-border bg-card-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple text-foreground';

function ConnectionCell({ c }: { c: Connection }) {
    return <StatusPill tone={TONE[c.view]} label={c.label} />;
}

/** Shows the NCC infrastructure a single collector is assigned to, for the collector's detail drawer. */
export function CollectorMappedInfrastructure({ collectorId, onChanged }: { collectorId: string; onChanged?: () => void }) {
    const can = useVmsCan();
    const canMap = can.role === 'super_admin' || can.role === 'soc_manager';
    const data = useVmsData<MappingResponse>(`/api/collectors/mappings?collector_id=${encodeURIComponent(collectorId)}`);
    const rows = data.data?.rows ?? [];
    const [editing, setEditing] = useState<MappingRow | null>(null);
    const [removing, setRemoving] = useState<MappingRow | null>(null);
    const [msg, setMsg] = useState<Msg>(null);
    const [adding, setAdding] = useState(false);

    return (
        <div className="space-y-3">
            <Notice msg={msg} />
            {data.load.state === 'error' ? <ErrorState error={data.load.error} status={data.load.status} onRetry={data.reload} /> : (
                rows.length === 0 ? <p className="text-xs text-foreground-muted">Not mapped to any NCC infrastructure yet.</p> : (
                    <ul className="space-y-2">
                        {rows.map((r) => (
                            <li key={r.mappingId} className="border border-border rounded-lg p-2.5 text-xs">
                                <p className="font-semibold text-foreground">{r.infrastructureName}</p>
                                <p className="text-foreground-muted">{r.infrastructureType}{r.quantity ? ` · quantity ${r.quantity}` : ''}</p>
                                <p className="text-foreground-muted">{r.hosting}</p>
                                {canMap && (
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={() => setEditing(r)} className={btn('secondary')}><Pencil className="w-3 h-3" aria-hidden /> Change</button>
                                        <button onClick={() => setRemoving(r)} className={btn('ghost')}><Trash2 className="w-3 h-3" aria-hidden /> Remove</button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )
            )}
            {canMap && <button onClick={() => setAdding(true)} className={btn('secondary')}><Plus className="w-3 h-3" aria-hidden /> Add infrastructure</button>}
            <MappingDrawer open={adding || !!editing} mapping={editing} lockedCollectorId={collectorId} onClose={() => { setAdding(false); setEditing(null); }}
                onSaved={(text) => { setAdding(false); setEditing(null); setMsg({ ok: true, text }); data.reload(); onChanged?.(); }} />
            <ConfirmDialog open={!!removing} title="Remove this mapping?" body={removing ? <>Removes the link between <b>{removing.collectorName}</b> and <b>{removing.infrastructureName}</b>. The collector and the NCC infrastructure entry are not changed.</> : null}
                confirmLabel="Remove mapping" tone="danger" onCancel={() => setRemoving(null)}
                onConfirm={async () => {
                    const r = removing!;
                    setRemoving(null);
                    const res = await vmsSend('DELETE', `/api/collectors/mappings/${r.mappingId}`);
                    if (res.ok) { setMsg({ ok: true, text: 'Mapping removed.' }); data.reload(); onChanged?.(); } else setMsg({ ok: false, text: res.error });
                }} />
        </div>
    );
}

function MappingDrawer({ open, mapping, lockedCollectorId, onClose, onSaved }: { open: boolean; mapping: MappingRow | null; lockedCollectorId: string | null; onClose: () => void; onSaved: (text: string) => void }) {
    const collectors = useVmsData<{ collectors: CollectorOption[] }>(open && !lockedCollectorId ? '/api/collectors' : null);
    const [collectorId, setCollectorId] = useState('');
    const [infrastructureId, setInfrastructureId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const editing = !!mapping;
    const cid = editing ? mapping!.collectorId : lockedCollectorId ?? collectorId;
    const iid = infrastructureId || (editing ? mapping!.infrastructureId : '');
    const selected = nccInfrastructureById(iid);

    async function save() {
        if (!cid) { setError('Choose a collector.'); return; }
        if (!iid) { setError('Choose an NCC infrastructure item.'); return; }
        setBusy(true);
        setError(null);
        const r = editing
            ? await vmsSend('PATCH', `/api/collectors/mappings/${mapping!.mappingId}`, { infrastructure_id: iid })
            : await vmsSend('POST', '/api/collectors/mappings', { collector_id: cid, infrastructure_id: iid });
        setBusy(false);
        if (!r.ok) { setError(r.error); return; }
        setCollectorId('');
        setInfrastructureId('');
        onSaved(editing ? 'Mapping updated and recorded in the audit log.' : 'Collector mapped and recorded in the audit log.');
    }

    return (
        <Drawer open={open} onClose={() => { setError(null); onClose(); }} title={editing ? 'Change infrastructure mapping' : 'Map collector to NCC infrastructure'}>
            <div className="space-y-4 text-xs">
                {!editing && !lockedCollectorId && (
                    <label className="block">
                        <span className="text-foreground-muted uppercase tracking-wide text-[11px] font-medium">Collector</span>
                        <select value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className={inputCls}>
                            <option value="">{collectors.load.state === 'loading' ? 'Loading collectors…' : 'Choose a collector…'}</option>
                            {(collectors.data?.collectors ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                )}
                {editing && <p className="text-foreground-muted">Collector: <span className="font-semibold text-foreground">{mapping!.collectorName}</span></p>}
                <label className="block">
                    <span className="text-foreground-muted uppercase tracking-wide text-[11px] font-medium">NCC infrastructure</span>
                    <select value={iid} onChange={(e) => setInfrastructureId(e.target.value)} className={inputCls}>
                        <option value="">Choose an infrastructure item…</option>
                        {NCC_INFRASTRUCTURE.map((i) => <option key={i.id} value={i.id}>{i.no}. {i.name} — {i.type}</option>)}
                    </select>
                </label>
                {selected && (
                    <dl className="border border-border rounded-lg p-3 space-y-1 bg-card-muted">
                        <div><dt className="inline text-foreground-muted">Type: </dt><dd className="inline">{selected.type}</dd></div>
                        <div><dt className="inline text-foreground-muted">Hosting / service: </dt><dd className="inline">{selected.hosting}</dd></div>
                        {selected.quantity !== null && <div><dt className="inline text-foreground-muted">Quantity in register: </dt><dd className="inline">{selected.quantity}</dd></div>}
                    </dl>
                )}
                <p className="text-foreground-muted">A collector can be mapped to an infrastructure item only once. Mapping records who made the change and when.</p>
                {error && <p role="alert" className="text-red font-semibold">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className={btn('ghost', 'md')}>Cancel</button>
                    <button onClick={() => void save()} disabled={busy} className={btn('primary', 'md')}>{busy ? 'Saving…' : editing ? 'Save change' : 'Save mapping'}</button>
                </div>
            </div>
        </Drawer>
    );
}

export function CollectorMappingWorkspace() {
    const can = useVmsCan();
    const canMap = can.role === 'super_admin' || can.role === 'soc_manager';
    const data = useVmsData<MappingResponse>('/api/collectors/mappings');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<MappingRow | null>(null);
    const [removing, setRemoving] = useState<MappingRow | null>(null);
    const [msg, setMsg] = useState<Msg>(null);

    const rows = data.data?.rows ?? null;
    const unmapped = data.data?.unmapped ?? [];
    const q = search.trim().toLowerCase();
    const filtered = useMemo(() => (rows ?? []).filter((r) =>
        (!q || r.collectorName.toLowerCase().includes(q) || r.collectorId.toLowerCase().includes(q)) &&
        (!typeFilter || r.infrastructureType === typeFilter) &&
        (!statusFilter || r.connection.view === statusFilter)), [rows, q, typeFilter, statusFilter]);

    const connected = (rows ?? []).filter((r) => r.connection.view === 'connected').length;
    const mappedCollectors = new Set((rows ?? []).map((r) => r.collectorId)).size;

    const columns: Column<MappingRow>[] = [
        {
            key: 'collector', header: 'Collector', className: 'min-w-[170px]', sort: (r) => r.collectorName, render: (r) => (
                <div>
                    <p className="font-semibold text-foreground">{r.collectorName}</p>
                    <p className="text-[10.5px] text-foreground-muted">{r.collectorKind.replace(/_/g, ' ')}</p>
                    <p className="font-mono text-[10px] text-foreground-muted" title={r.collectorId}>ID {r.collectorId.slice(0, 8)}</p>
                </div>
            ),
        },
        { key: 'infra', header: 'Infrastructure / type', className: 'min-w-[190px]', sort: (r) => r.infrastructureName, render: (r) => <div><p className="text-xs font-semibold text-foreground">{r.infrastructureName}</p><p className="text-[10.5px] text-foreground">{r.infrastructureType}</p><p className="text-[10.5px] text-foreground-muted">{r.hosting}</p></div> },
        {
            key: 'status', header: 'Connection', className: 'min-w-[170px]', sort: (r) => r.connection.view, render: (r) => (
                <div className="space-y-1">
                    <ConnectionCell c={r.connection} />
                    <p className="text-[10.5px] text-foreground-muted whitespace-nowrap">Heartbeat: {r.connection.lastHeartbeat ? fmtWat(r.connection.lastHeartbeat) : r.connection.lastHeartbeatLabel}</p>
                    <p className="text-[10.5px] text-foreground-muted whitespace-nowrap">Data: {r.connection.lastData ? fmtWat(r.connection.lastData) : r.connection.lastDataLabel}</p>
                </div>
            ),
        },
        {
            key: 'discovered', header: 'Discovered asset', className: 'min-w-[170px]', sort: (r) => r.discoveredAsset?.at ?? '', render: (r) => r.discoveredAsset ? (
                <div className="text-[11px]">
                    <a href={`/admin/vms/assets/${r.discoveredAsset.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-blue hover:underline break-all">{r.discoveredAsset.name}</a>
                    <p className="text-foreground-muted">{r.discoveredAsset.at ? `Simulated · ${fmtWat(r.discoveredAsset.at)}` : 'Simulated discovery'}</p>
                </div>
            ) : <span className="text-[11px] text-foreground-muted">{r.connection.view === 'connected' || r.connection.view === 'stale' ? 'Discovering…' : 'Awaiting Operational'}</span>,
        },
        {
            key: 'actions', header: 'Actions', render: (r) => canMap ? (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditing(r)} className={btn('ghost')} aria-label={`Change mapping for ${r.collectorName}`} title="Change mapping"><Pencil className="w-3.5 h-3.5" aria-hidden /></button>
                    <button onClick={() => setRemoving(r)} className={btn('ghost')} aria-label={`Remove mapping for ${r.collectorName}`} title="Remove mapping"><Trash2 className="w-3.5 h-3.5" aria-hidden /></button>
                </div>
            ) : <span className="text-[11px] text-foreground-muted">View only</span>,
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={Link2} title="Collector Mapping"
                description="Which collectors are assigned to which NCC infrastructure, and what the platform has recorded for each. Status reflects the collector's recorded lifecycle on the platform clock; no real device connection is verified in this build."
                actions={canMap ? <button onClick={() => setAdding(true)} className={btn('primary', 'md')}><Plus className="w-3.5 h-3.5" aria-hidden /> Map collector</button> : undefined} />
            <Notice msg={msg} />
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Mappings" value={rows?.length} />
                <KpiCard label="Mapped collectors" value={rows ? mappedCollectors : undefined} />
                <KpiCard label="Connected" value={rows ? connected : undefined} tone="good" />
                <KpiCard label="Not mapped" value={data.data ? unmapped.length : undefined} tone={unmapped.length ? 'warning' : 'neutral'} />
            </section>

            <div className="flex flex-col md:flex-row gap-2">
                <label className="relative flex-1 md:max-w-xs">
                    <span className="sr-only">Search by collector name or ID</span>
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" aria-hidden />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search collector name or ID" className={`${inputCls} pl-9`} />
                </label>
                <select aria-label="Filter by infrastructure type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} md:w-64`}>
                    <option value="">All infrastructure types</option>
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select aria-label="Filter by connection status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} md:w-52`}>
                    <option value="">All connection states</option>
                    {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
            </div>

            {data.load.state === 'error' ? <ErrorState error={data.load.error} status={data.load.status} onRetry={data.reload} /> : (
                <DataTable caption="Collector mappings" rows={filtered} columns={columns} rowKey={(r) => r.mappingId} initialSort={{ key: 'collector', dir: 'asc' }}
                    empty={rows && rows.length === 0 && !q && !typeFilter && !statusFilter
                        ? <EmptyState icon={Link2} title="No collector is mapped yet" body="Map a collector to an NCC infrastructure item to see it here." action={canMap ? <button onClick={() => setAdding(true)} className={btn('primary', 'md')}>Map collector</button> : undefined} />
                        : 'No mappings match these filters.'} />
            )}

            {unmapped.length > 0 && (
                <Card>
                    <SectionTitle title="Collectors not mapped to NCC infrastructure" hint="Created but not yet assigned to an infrastructure item." />
                    <ul className="divide-y divide-border">
                        {unmapped.filter((u) => !q || u.collectorName.toLowerCase().includes(q)).map((u) => (
                            <li key={u.collectorId} className="py-2 flex items-center gap-3 flex-wrap text-xs">
                                <span className="font-semibold text-foreground flex-1 min-w-[140px]">{u.collectorName}</span>
                                <ConnectionCell c={u.connection} />
                                {canMap && <button onClick={() => setAdding(true)} className={btn('secondary')}>Map</button>}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <MappingDrawer open={adding || !!editing} mapping={editing} lockedCollectorId={null} onClose={() => { setAdding(false); setEditing(null); }}
                onSaved={(text) => { setAdding(false); setEditing(null); setMsg({ ok: true, text }); data.reload(); }} />
            <ConfirmDialog open={!!removing} title="Remove this mapping?" body={removing ? <>Removes the link between <b>{removing.collectorName}</b> and <b>{removing.infrastructureName}</b>. Neither record is deleted.</> : null}
                confirmLabel="Remove mapping" tone="danger" onCancel={() => setRemoving(null)}
                onConfirm={async () => {
                    const r = removing!;
                    setRemoving(null);
                    const res = await vmsSend('DELETE', `/api/collectors/mappings/${r.mappingId}`);
                    if (res.ok) { setMsg({ ok: true, text: 'Mapping removed and recorded in the audit log.' }); data.reload(); } else setMsg({ ok: false, text: res.error });
                }} />
        </div>
    );
}
