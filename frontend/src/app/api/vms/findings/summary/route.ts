import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getFindingsSummary } from '@ncc-it/backend/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json(getFindingsSummary());
    } catch (err) {
        return authErrorResponse(err);
    }
}
