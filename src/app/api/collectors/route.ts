import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { createCollector, getOrganisation, listCollectors } from '@/lib/simulation/engine';
import type { CollectorInfraCategory, CollectorKind } from '@/lib/simulation/types';

const KINDS: CollectorKind[] = ['endpoint', 'network_telemetry', 'api_connector', 'log_forwarding', 'agentless', 'vuln_assessment'];
const CATEGORIES: CollectorInfraCategory[] = ['servers', 'middleware', 'cloud', 'endpoints', 'dev_workstations', 'network', 'firewall'];

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const orgId = req.nextUrl.searchParams.get('org_id') ?? undefined;
        return NextResponse.json({ collectors: listCollectors(orgId) });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireSession(['super_admin', 'soc_manager', 'executive']);
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? '').trim();
        const orgId = String(body.org_id ?? '');
        const collectorKind = KINDS.includes(body.collector_kind) ? body.collector_kind : null;
        const infraCategory = CATEGORIES.includes(body.infra_category) ? body.infra_category : null;
        if (!name || !orgId || !collectorKind || !infraCategory) return NextResponse.json({ error: 'name, org_id, a valid collector_kind and infra_category are required' }, { status: 400 });
        if (!getOrganisation(orgId)) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

        const collector = await createCollector({
            name, collectorKind, infraCategory, orgId,
            businessUnit: String(body.business_unit ?? ''), assetScope: String(body.asset_scope ?? ''),
            collectionIntervalMinutes: Number(body.collection_interval_minutes ?? 15) || 15,
        });
        return NextResponse.json(collector, { status: 201 });
    } catch (err) {
        return authErrorResponse(err);
    }
}
