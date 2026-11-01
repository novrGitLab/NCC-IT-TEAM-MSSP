import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getFindingsSummary } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json(getFindingsSummary());
    } catch (err) {
        return authErrorResponse(err);
    }
}
