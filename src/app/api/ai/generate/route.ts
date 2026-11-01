import { NextRequest, NextResponse } from 'next/server';
import { requireAnySession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { saveArtifact } from '@/lib/simulation/engine';
import { AiNotAvailableError, RateLimitedError, checkRateLimit, generate, isConfigured, PURPOSE_TO_SUBJECT_TYPE, resolveSubject } from '@/lib/simulation/ai/analyst';

export async function POST(req: NextRequest) {
    try {
        const user = await requireAnySession();
        const body = await req.json().catch(() => ({}));
        const purpose = String(body.purpose ?? '');
        const subjectId = String(body.subject_id ?? '');
        if (!purpose || !subjectId) return NextResponse.json({ error: 'purpose and subject_id are required' }, { status: 400 });

        if (!isConfigured()) return NextResponse.json({ error: 'AI is not configured in this environment.' }, { status: 503 });

        checkRateLimit(user.id);

        const subjectType = PURPOSE_TO_SUBJECT_TYPE[purpose] ?? 'alert';
        const subject = resolveSubject(subjectType, subjectId);
        if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

        const { content, model } = await generate(purpose, subject);
        const artifact = await saveArtifact({ purpose, subjectType, subjectId, content, model });
        return NextResponse.json({ artifact: { id: artifact.id, purpose: artifact.purpose, content: artifact.content, model: artifact.model, created_at: artifact.createdAt, status: artifact.status, feedback: artifact.feedback, feedback_by: artifact.feedbackBy } });
    } catch (err) {
        if (err instanceof AiNotAvailableError) return NextResponse.json({ error: err.message }, { status: 503 });
        if (err instanceof RateLimitedError) return NextResponse.json({ error: err.message }, { status: 429 });
        return authErrorResponse(err);
    }
}
