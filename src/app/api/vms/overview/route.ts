import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getVmsOverview } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json(getVmsOverview());
    } catch (err) {
        return authErrorResponse(err);
    }
}
