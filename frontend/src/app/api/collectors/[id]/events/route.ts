import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getCollector, listIngestionEvents } from '@ncc-it/backend/simulation/engine';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession();
        const { id } = await params;
        const collector = getCollector(id);
        if (!collector || (user.orgId && collector.orgId !== user.orgId)) return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
        return NextResponse.json({ events: listIngestionEvents(id) });
    } catch (err) {
        return authErrorResponse(err);
    }
}
