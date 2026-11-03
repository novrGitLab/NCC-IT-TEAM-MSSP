import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { setAlertStatus } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        if (typeof body.status !== 'string') return NextResponse.json({ error: 'status is required' }, { status: 400 });
        const alert = await setAlertStatus(id, body.status, user.name || user.email);
        return NextResponse.json({ alert });
    } catch (err) {
        return socErrorResponse(err);
    }
}
