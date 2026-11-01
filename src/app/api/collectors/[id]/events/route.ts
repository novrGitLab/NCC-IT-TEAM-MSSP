import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listIngestionEvents } from '@/lib/simulation/engine';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        return NextResponse.json({ events: listIngestionEvents(id) });
    } catch (err) {
        return authErrorResponse(err);
    }
}
