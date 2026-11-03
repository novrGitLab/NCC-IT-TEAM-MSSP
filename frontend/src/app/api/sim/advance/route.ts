import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { advanceSimulationTime } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

/** Illustrative environment only: moves the shared simulation clock forward and runs the SOC policy. */
export async function POST(req: NextRequest) {
    try {
        const user = await requireSession(['super_admin']);
        const body = await req.json().catch(() => ({}));
        const result = await advanceSimulationTime(Number(body.minutes), user.name || user.email);
        return NextResponse.json(result);
    } catch (err) {
        return socErrorResponse(err);
    }
}
