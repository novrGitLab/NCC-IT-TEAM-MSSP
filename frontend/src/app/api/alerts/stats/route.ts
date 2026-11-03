import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { alertStatsShared } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json(alertStatsShared());
    } catch (err) {
        return socErrorResponse(err);
    }
}
