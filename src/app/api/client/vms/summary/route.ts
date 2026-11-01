import { NextResponse } from 'next/server';
import { requirePortalSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getFindingsSummary, getRiskScore } from '@/lib/simulation/engine';
import { loadState } from '@/lib/simulation/store';

export async function GET() {
    try {
        await requirePortalSession();
        const state = loadState();
        return NextResponse.json({ total_assets: state.assets.length, open_findings: getFindingsSummary().open, risk_score: getRiskScore(), by_severity: getFindingsSummary().by_severity });
    } catch (err) {
        return authErrorResponse(err);
    }
}
