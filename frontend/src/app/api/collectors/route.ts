import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { createCollector, getOrganisation, listCollectors } from '@ncc-it/backend/simulation/engine';
import { createMapping, MappingError } from '@ncc-it/backend/simulation/collector-mapping';
import { nccInfrastructureById } from '@ncc-it/backend/contracts/ncc-infrastructure';
import type { CollectorKind } from '@ncc-it/backend/simulation/types';

const KINDS: CollectorKind[] = ['endpoint', 'network_telemetry', 'api_connector', 'log_forwarding', 'agentless', 'vuln_assessment'];

export async function GET(req: NextRequest) {
    try {
        const user = await requireSession();
        // An organisation-bound user always sees only their own organisation; the query string cannot widen that.
        const orgId = user.orgId ?? req.nextUrl.searchParams.get('org_id') ?? undefined;
        return NextResponse.json({ collectors: listCollectors(orgId) });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager']);
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? '').trim();
        const orgId = String(body.org_id ?? '');
        const collectorKind = KINDS.includes(body.collector_kind) ? body.collector_kind : null;
        // One or more NCC infrastructure items; ncc_infrastructure_id (single) is still accepted.
        const requested: unknown[] = Array.isArray(body.ncc_infrastructure_ids) ? body.ncc_infrastructure_ids : body.ncc_infrastructure_id ? [body.ncc_infrastructure_id] : [];
        const ids = [...new Set(requested.map((x) => String(x)))];
        const items = ids.map((id) => nccInfrastructureById(id));
        if (!name || !orgId || !collectorKind || items.length === 0 || items.some((i) => !i) || items.length > 17) {
            return NextResponse.json({ error: 'name, org_id, a collector method and at least one valid NCC infrastructure item are required' }, { status: 400 });
        }
        const item = items[0]!;
        if (!getOrganisation(orgId) || (user.orgId && user.orgId !== orgId)) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

        const collector = await createCollector({
            name, collectorKind, infraCategory: item.engineCategory, orgId,
            businessUnit: String(body.business_unit ?? ''), assetScope: String(body.asset_scope ?? ''),
            collectionIntervalMinutes: Number(body.collection_interval_minutes ?? 15) || 15,
        });
        try {
            for (const i of items) await createMapping(collector.id, i!.id, user.name || user.email);
        } catch (err) {
            if (err instanceof MappingError) return NextResponse.json({ error: err.message }, { status: err.status });
            throw err;
        }
        return NextResponse.json(collector, { status: 201 });
    } catch (err) {
        return authErrorResponse(err);
    }
}
