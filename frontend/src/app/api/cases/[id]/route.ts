import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getCaseDetail, patchCase } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const detail = getCaseDetail(id);
        if (!detail) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        return NextResponse.json(detail);
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const changes: { status?: string; assigned_to?: string | null } = {};
        if (typeof body.status === 'string') changes.status = body.status;
        if (typeof body.assigned_to === 'string' || body.assigned_to === null) changes.assigned_to = body.assigned_to;
        const updated = await patchCase(id, changes, user.name || user.email);
        return NextResponse.json({ case: updated });
    } catch (err) {
        return socErrorResponse(err);
    }
}
