import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getAsset } from '@/lib/simulation/engine';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const a = getAsset(id);
        if (!a) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        return NextResponse.json({ nodes: [{ id: a.id, value: a.value, asset_type: a.asset_type }], edges: [] });
    } catch (err) {
        return authErrorResponse(err);
    }
}
