import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getAssetDetail, patchAsset } from '@/lib/simulation/engine';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const detail = getAssetDetail(id);
        if (!detail) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        return NextResponse.json(detail);
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
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
