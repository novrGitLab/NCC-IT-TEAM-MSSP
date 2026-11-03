import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { buildWeeklyFacts } from '@ncc-it/backend/simulation/insights';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const requested = Number(req.nextUrl.searchParams.get('days') ?? 7);
        const days = Number.isFinite(requested) ? Math.min(90, Math.max(1, Math.round(requested))) : 7;
        return NextResponse.json(buildWeeklyFacts(loadState(), days, Date.now()));
    } catch (err) {
        return authErrorResponse(err);
    }
}
