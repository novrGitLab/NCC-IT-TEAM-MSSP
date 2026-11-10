import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { createMapping, listMappingRows, MappingError } from '@ncc-it/backend/simulation/collector-mapping';

const MANAGE_ROLES = ['super_admin', 'soc_manager'] as const;

/** Mapping rows for the Collector Mapping workspace. A signed-in user with an organisation sees only
 *  that organisation's collectors; the organisation is never taken from the query string alone. */
export async function GET(req: NextRequest) {
    try {
        const user = await requireSession();
        const collectorId = req.nextUrl.searchParams.get('collector_id');
        return NextResponse.json(listMappingRows(loadState(), { orgId: user.orgId ?? null, collectorId }));
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireSession([...MANAGE_ROLES]);
        const body = await req.json().catch(() => ({}));
        const collectorId = String(body.collector_id ?? '');
        const infrastructureId = String(body.infrastructure_id ?? '');
        if (!collectorId || !infrastructureId) return NextResponse.json({ error: 'collector_id and infrastructure_id are required' }, { status: 400 });
        if (user.orgId && !loadState().collectors.some((c) => c.id === collectorId && c.orgId === user.orgId)) {
            return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
        }
        const mapping = await createMapping(collectorId, infrastructureId, user.name || user.email);
        return NextResponse.json({ mapping }, { status: 201 });
    } catch (err) {
        if (err instanceof MappingError) return NextResponse.json({ error: err.message }, { status: err.status });
        return authErrorResponse(err);
    }
}
