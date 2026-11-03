import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getAlert, setAlertStatus } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const alert = getAlert(id);
        if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
        return NextResponse.json({ alert });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
