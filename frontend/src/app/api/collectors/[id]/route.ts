import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getCollector, pauseCollector, removeCollector, resumeCollector } from '@ncc-it/backend/simulation/engine';

/** An organisation-bound user can only reach their own organisation's collectors; others look absent. */
function inScope(user: { orgId: string | null }, id: string): boolean {
    const c = getCollector(id);
    return !!c && (!user.orgId || c.orgId === user.orgId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession();
        const { id } = await params;
        if (!inScope(user, id)) return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
        return NextResponse.json(getCollector(id));
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'executive']);
        const { id } = await params;
        if (!inScope(user, id)) return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
        const body = await req.json().catch(() => ({}));
        const action = String(body.action ?? '');
        const updated = action === 'pause' ? await pauseCollector(id) : action === 'resume' ? await resumeCollector(id) : null;
        if (!updated) return NextResponse.json({ error: action ? 'Collector not found' : 'action must be "pause" or "resume"' }, { status: action ? 404 : 400 });
        return NextResponse.json(updated);
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager']);
        const { id } = await params;
        if (!inScope(user, id)) return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
        const removed = await removeCollector(id);
        return removed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Collector not found' }, { status: 404 });
    } catch (err) {
        return authErrorResponse(err);
    }
}
