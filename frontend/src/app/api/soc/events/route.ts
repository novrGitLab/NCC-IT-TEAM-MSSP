import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { recentEvents } from '@ncc-it/backend/simulation/soc-store';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 25) || 25));
        return NextResponse.json({ events: recentEvents(limit) });
    } catch (err) {
        return authErrorResponse(err);
    }
}
