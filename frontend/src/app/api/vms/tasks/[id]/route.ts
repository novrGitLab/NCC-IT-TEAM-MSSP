import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { patchTaskByTaskId } from '@ncc-it/backend/simulation/engine';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const updated = await patchTaskByTaskId(id, { status: body.status, owner: body.owner === undefined ? undefined : (body.owner as string | null), due_at: body.due_at === undefined ? undefined : (body.due_at as string | null) });
        if (!updated) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        return NextResponse.json({ message: 'Task status applied and persisted to the simulation state.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
