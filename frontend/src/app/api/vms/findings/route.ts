import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { findingsByStatusGroup } from '@ncc-it/backend/simulation/engine';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const assetId = req.nextUrl.searchParams.get('asset_id');
        let list = findingsByStatusGroup(req.nextUrl.searchParams.get('status'));
        if (assetId) list = list.filter((f) => f.asset_id === assetId);
        return NextResponse.json({ findings: list, total: list.length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
