// Collector-to-NCC-infrastructure mappings. Stored in the shared simulation state (same persisted file
// as the collectors), so they survive restarts. Every change is written to the audit log in the same
// save. Collector status is derived only from the collector's own recorded lifecycle and the platform
// clock; nothing here reports a real device connection.
import { randomUUID } from 'node:crypto';
import { loadState, saveState } from './store';
import { nccInfrastructureById } from '../contracts/ncc-infrastructure';
import type { CollectorRecord, CollectorInfraMappingRecord, SimState } from './types';

export class MappingError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

export type ConnectionView = 'created' | 'registered' | 'connected' | 'stale' | 'offline' | 'error';

export interface ConnectionState {
    view: ConnectionView;
    label: string;
    /** Honest text for the heartbeat and data columns when nothing has been recorded yet. */
    lastHeartbeat: string | null;
    lastHeartbeatLabel: string;
    lastData: string | null;
    lastDataLabel: string;
}

const LABEL: Record<ConnectionView, string> = {
    created: 'Created',
    registered: 'Registered',
    connected: 'Connected',
    stale: 'Stale',
    offline: 'Offline',
    error: 'Error',
};

/** Derives the connection view from the collector's recorded status and the platform clock. */
export function connectionStateOf(c: CollectorRecord, nowIso: string): ConnectionState {
    let view: ConnectionView;
    if (c.status === 'error') view = 'error';
    else if (c.status === 'paused') view = 'offline';
    else if (c.status === 'created') view = 'created';
    else if (c.status === 'configuring' || c.status === 'connecting' || c.status === 'validating') view = 'registered';
    else if (!c.lastHeartbeat) view = 'registered';
    else {
        const ageMin = (Date.parse(nowIso) - Date.parse(c.lastHeartbeat)) / 60_000;
        view = ageMin > 2 * c.collectionIntervalMinutes ? 'stale' : 'connected';
    }
    return {
        view,
        label: LABEL[view],
        lastHeartbeat: c.lastHeartbeat,
        lastHeartbeatLabel: c.lastHeartbeat ? c.lastHeartbeat : 'Awaiting first heartbeat',
        lastData: c.lastSync,
        lastDataLabel: c.lastSync ? c.lastSync : 'No data received',
    };
}

export interface MappingRow {
    mappingId: string;
    collectorId: string;
    collectorName: string;
    collectorKind: string;
    infrastructureId: string;
    infrastructureName: string;
    infrastructureType: string;
    hosting: string;
    quantity: number | null;
    connection: ConnectionState;
    updatedAt: string;
    updatedBy: string;
}

/** Rows for the Collector Mapping workspace. Collectors with no mapping appear once with a null mapping. */
export function listMappingRows(state: SimState, opts: { orgId?: string | null; collectorId?: string | null } = {}): {
    rows: MappingRow[];
    unmapped: { collectorId: string; collectorName: string; collectorKind: string; connection: ConnectionState }[];
    simulated: true;
} {
    const nowIso = state.clock.nowIso;
    const visible = state.collectors.filter((c) => (opts.orgId ? c.orgId === opts.orgId : true) && (opts.collectorId ? c.id === opts.collectorId : true));
    const rows: MappingRow[] = [];
    const unmapped: { collectorId: string; collectorName: string; collectorKind: string; connection: ConnectionState }[] = [];
    for (const c of visible) {
        const mine = state.collectorMappings.filter((m) => m.collectorId === c.id);
        if (mine.length === 0) {
            unmapped.push({ collectorId: c.id, collectorName: c.name, collectorKind: c.collectorKind, connection: connectionStateOf(c, nowIso) });
            continue;
        }
        for (const m of mine) {
            const item = nccInfrastructureById(m.infrastructureId);
            if (!item) continue;
            rows.push({
                mappingId: m.id, collectorId: c.id, collectorName: c.name, collectorKind: c.collectorKind,
                infrastructureId: item.id, infrastructureName: item.name, infrastructureType: item.type, hosting: item.hosting, quantity: item.quantity,
                connection: connectionStateOf(c, nowIso), updatedAt: m.updatedAt, updatedBy: m.updatedBy,
            });
        }
    }
    return { rows, unmapped, simulated: true };
}

function collectorOrThrow(state: SimState, id: string): CollectorRecord {
    const c = state.collectors.find((x) => x.id === id);
    if (!c) throw new MappingError('Collector not found.', 404);
    return c;
}

function assertInfrastructure(id: string): void {
    if (!nccInfrastructureById(id)) throw new MappingError('Unknown NCC infrastructure item.', 400);
}

function duplicateOf(state: SimState, collectorId: string, infrastructureId: string, exceptMappingId: string | null): CollectorInfraMappingRecord | undefined {
    return state.collectorMappings.find((m) => m.collectorId === collectorId && m.infrastructureId === infrastructureId && m.id !== exceptMappingId);
}

/** Maps a collector to an NCC infrastructure item. The collector's organisation is taken from the
 *  collector record, never from the request. A duplicate pairing is refused. */
export async function createMapping(collectorId: string, infrastructureId: string, actor: string): Promise<CollectorInfraMappingRecord> {
    assertInfrastructure(infrastructureId);
    const out: { mapping: CollectorInfraMappingRecord | null } = { mapping: null };
    await saveState((draft) => {
        const c = collectorOrThrow(draft, collectorId);
        if (duplicateOf(draft, collectorId, infrastructureId, null)) throw new MappingError('This collector is already mapped to that infrastructure item.', 409);
        const now = new Date().toISOString();
        const mapping: CollectorInfraMappingRecord = { id: `map-${randomUUID()}`, orgId: c.orgId, collectorId, infrastructureId, createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor };
        draft.collectorMappings.push(mapping);
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at: now, actor, action: 'collector.mapping_created', details: { mapping_id: mapping.id, collector_id: collectorId, infrastructure_id: infrastructureId } });
        out.mapping = mapping;
    });
    return out.mapping as CollectorInfraMappingRecord;
}

/** Points an existing mapping at a different infrastructure item, keeping the duplicate rule. */
export async function updateMapping(mappingId: string, infrastructureId: string, actor: string): Promise<CollectorInfraMappingRecord> {
    assertInfrastructure(infrastructureId);
    const out: { mapping: CollectorInfraMappingRecord | null } = { mapping: null };
    await saveState((draft) => {
        const m = draft.collectorMappings.find((x) => x.id === mappingId);
        if (!m) throw new MappingError('Mapping not found.', 404);
        if (duplicateOf(draft, m.collectorId, infrastructureId, mappingId)) throw new MappingError('This collector is already mapped to that infrastructure item.', 409);
        const now = new Date().toISOString();
        const before = m.infrastructureId;
        m.infrastructureId = infrastructureId;
        m.updatedAt = now;
        m.updatedBy = actor;
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at: now, actor, action: 'collector.mapping_updated', details: { mapping_id: mappingId, collector_id: m.collectorId, from: before, to: infrastructureId } });
        out.mapping = m;
    });
    return out.mapping as CollectorInfraMappingRecord;
}

export async function deleteMapping(mappingId: string, actor: string): Promise<void> {
    await saveState((draft) => {
        const m = draft.collectorMappings.find((x) => x.id === mappingId);
        if (!m) throw new MappingError('Mapping not found.', 404);
        const now = new Date().toISOString();
        draft.collectorMappings = draft.collectorMappings.filter((x) => x.id !== mappingId);
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at: now, actor, action: 'collector.mapping_removed', details: { mapping_id: mappingId, collector_id: m.collectorId, infrastructure_id: m.infrastructureId } });
    });
}
