import { NextRequest, NextResponse } from 'next/server';
import { requireAnySession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listArtifacts } from '@/lib/simulation/engine';

export async function GET(req: NextRequest) {
    try {
        await requireAnySession();
        const subjectType = req.nextUrl.searchParams.get('subject_type') ?? '';
        const subjectId = req.nextUrl.searchParams.get('subject_id') ?? '';
        const artifacts = listArtifacts(subjectType, subjectId).map((a) => ({ id: a.id, purpose: a.purpose, content: a.content, model: a.model, created_at: a.createdAt, status: a.status, feedback: a.feedback, feedback_by: a.feedbackBy }));
        return NextResponse.json({ artifacts });
    } catch (err) {
        return authErrorResponse(err);
    }
}
