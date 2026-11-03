import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { listApprovals } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        return NextResponse.json(listApprovals(req.nextUrl.searchParams.get('status')));
    } catch (err) {
        return socErrorResponse(err);
    }
}
