import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { listCases } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function POST() {
    return NextResponse.json({ error: 'Cases are opened from an alert in this build; manual case creation is not available yet.' }, { status: 501 });
}

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const p = req.nextUrl.searchParams;
        const limit = Math.min(200, Math.max(1, Number(p.get('limit') ?? 200) || 200));
        return NextResponse.json(listCases({ excludeAutoClosed: p.get('exclude_auto_closed') === 'true', since: p.get('since'), limit }));
    } catch (err) {
        return socErrorResponse(err);
    }
}
