import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { listAlerts } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const p = req.nextUrl.searchParams;
        const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 200) || 200));
        return NextResponse.json(listAlerts({ status: p.get('status'), severity: p.get('severity'), q: p.get('q') ?? p.get('search'), limit }));
    } catch (err) {
        return socErrorResponse(err);
    }
}
