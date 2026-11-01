import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getPostureSummary } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json(getPostureSummary());
    } catch (err) {
        return authErrorResponse(err);
    }
}
