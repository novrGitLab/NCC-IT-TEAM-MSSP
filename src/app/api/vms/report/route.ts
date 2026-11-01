import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getFindingsSummary, listAssets } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ summary: getFindingsSummary(), assets_total: listAssets().length, generated_at: new Date().toISOString() });
    } catch (err) {
        return authErrorResponse(err);
    }
}
