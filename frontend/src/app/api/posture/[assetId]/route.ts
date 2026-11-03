import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { computeAssetPosture, getAsset, listPostureEvents } from '@ncc-it/backend/simulation/engine';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
    try {
        await requireSession();
        const { assetId } = await params;
        if (!getAsset(assetId)) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        return NextResponse.json({ posture: computeAssetPosture(assetId), events: listPostureEvents(assetId) });
    } catch (err) {
        return authErrorResponse(err);
    }
}
