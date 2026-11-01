import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { findingDetail, patchFinding } from '@/lib/simulation/engine';
import type { FindingStatus } from '@/lib/simulation/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const detail = findingDetail(id);
        if (!detail) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
        return NextResponse.json(detail);
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const updated = await patchFinding(id, {
            status: body.status as FindingStatus | undefined,
            owner: body.owner === undefined ? undefined : (body.owner as string | null),
            due_at: body.due_at === undefined ? undefined : (body.due_at as string | null),
        });
        if (!updated) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
        return NextResponse.json({ finding: updated, message: 'Status change applied and persisted to the simulation state.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
