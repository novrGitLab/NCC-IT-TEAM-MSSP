import { NextResponse } from 'next/server';
import { requirePortalSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listAssets } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requirePortalSession();
        const assets = listAssets();
        return NextResponse.json({ assets, total: assets.length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
