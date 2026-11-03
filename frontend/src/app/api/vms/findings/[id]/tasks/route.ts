import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { addExtraTask } from '@ncc-it/backend/simulation/engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const task = await addExtraTask(id, { title: String(body.title ?? 'Remediation task'), details: body.details ? String(body.details) : undefined, owner: body.owner ? String(body.owner) : undefined, due_at: body.due_at ? String(body.due_at) : undefined, ai_artifact_id: body.ai_artifact_id as string | null | undefined });
        return NextResponse.json({ task, message: 'Task added and persisted to the simulation state.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
