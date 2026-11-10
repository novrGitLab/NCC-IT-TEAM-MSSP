import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { deleteMapping, MappingError, updateMapping } from '@ncc-it/backend/simulation/collector-mapping';

const MANAGE_ROLES = ['super_admin', 'soc_manager'] as const;

async function assertInScope(user: { orgId: string | null }, mappingId: string): Promise<boolean> {
    const m = loadState().collectorMappings.find((x) => x.id === mappingId);
    if (!m) return false;
    return !user.orgId || m.orgId === user.orgId;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession([...MANAGE_ROLES]);
        const { id } = await params;
        if (!(await assertInScope(user, id))) return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
        const body = await req.json().catch(() => ({}));
        const infrastructureId = String(body.infrastructure_id ?? '');
        if (!infrastructureId) return NextResponse.json({ error: 'infrastructure_id is required' }, { status: 400 });
        const mapping = await updateMapping(id, infrastructureId, user.name || user.email);
        return NextResponse.json({ mapping });
    } catch (err) {
        if (err instanceof MappingError) return NextResponse.json({ error: err.message }, { status: err.status });
        return authErrorResponse(err);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession([...MANAGE_ROLES]);
        const { id } = await params;
        if (!(await assertInScope(user, id))) return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
        await deleteMapping(id, user.name || user.email);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof MappingError) return NextResponse.json({ error: err.message }, { status: err.status });
        return authErrorResponse(err);
    }
}
