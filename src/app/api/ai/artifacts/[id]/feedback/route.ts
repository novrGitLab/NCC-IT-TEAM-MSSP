import { NextRequest, NextResponse } from 'next/server';
import { requireAnySession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { setArtifactFeedback } from '@/lib/simulation/engine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAnySession();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const status = body.status === 'accepted' || body.status === 'rejected' ? body.status : null;
        if (!status) return NextResponse.json({ error: 'status must be "accepted" or "rejected"' }, { status: 400 });
        const updated = await setArtifactFeedback(id, status, typeof body.feedback === 'string' ? body.feedback : null, user.name);
        if (!updated) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
        return NextResponse.json({ artifact: { id: updated.id, purpose: updated.purpose, content: updated.content, model: updated.model, created_at: updated.createdAt, status: updated.status, feedback: updated.feedback, feedback_by: updated.feedbackBy } });
    } catch (err) {
        return authErrorResponse(err);
    }
}
