import { NextResponse } from 'next/server';
import { requirePortalSession, authErrorResponse } from '@/lib/auth/guard';
import { listAssets } from '@ncc-it/backend/simulation/engine';

export async function GET() {
    try {
        await requirePortalSession();
        const assets = listAssets();
        return NextResponse.json({ assets, total: assets.length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
