import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getAssetDetail, patchAsset } from '@ncc-it/backend/simulation/engine';
import { loadState } from '@ncc-it/backend/simulation/store';
import { withDiscoveryView } from '@ncc-it/backend/simulation/ncc-discovery';

/** Organisation-bound users only reach shared demo assets and their own organisation's assets. */
function visibleTo(user: { orgId: string | null }, id: string): boolean {
    const a = loadState().assets.find((x) => x.id === id);
    return !!a && (!user.orgId || !a.org_id || a.org_id === user.orgId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession();
        const { id } = await params;
        const detail = getAssetDetail(id);
        if (!detail || !visibleTo(user, id)) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        return NextResponse.json({ ...detail, asset: withDiscoveryView(loadState(), [detail.asset])[0] });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession();
        const { id } = await params;
        if (!visibleTo(user, id)) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        const body = await req.json().catch(() => ({}));
        const changes: { owner?: string; criticality?: 'low' | 'medium' | 'high' | 'critical' } = {};
        if (typeof body.owner === 'string') changes.owner = body.owner;
        if (body.criticality === 'critical' || body.criticality === 'high' || body.criticality === 'medium' || body.criticality === 'low') changes.criticality = body.criticality;
        const asset = await patchAsset(id, changes);
        if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        return NextResponse.json({ asset, message: 'Change applied and persisted to the simulation state.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
