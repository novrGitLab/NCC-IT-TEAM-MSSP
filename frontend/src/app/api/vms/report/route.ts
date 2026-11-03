import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { buildVulnerabilityReport } from '@ncc-it/backend/simulation/reports';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const requested = Number(req.nextUrl.searchParams.get('days') ?? 30);
        const days = Number.isFinite(requested) ? Math.min(365, Math.max(1, Math.round(requested))) : 30;
        return NextResponse.json(buildVulnerabilityReport(loadState(), days, Date.now()));
    } catch (err) {
        return authErrorResponse(err);
    }
}
