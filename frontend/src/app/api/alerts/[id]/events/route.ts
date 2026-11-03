import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { alertEvents } from '@ncc-it/backend/simulation/soc-store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const events = alertEvents(id);
        if (!events) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
        return NextResponse.json({ events });
    } catch (err) {
        return authErrorResponse(err);
    }
}
