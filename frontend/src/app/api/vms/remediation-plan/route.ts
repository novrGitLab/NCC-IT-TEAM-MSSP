import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { buildRemediationPlan, decideRemediationPlan, PlanError } from '@ncc-it/backend/simulation/remediation-plan';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const findingId = req.nextUrl.searchParams.get('finding')?.trim() ?? '';
        if (!findingId) return NextResponse.json({ error: 'A finding ID is required (?finding=<id>).' }, { status: 400 });
        const plan = buildRemediationPlan(loadState(), findingId, Date.now());
        if (!plan) return NextResponse.json({ error: `No finding with ID "${findingId}". Check the ID in the Findings list.` }, { status: 404 });
        return NextResponse.json({ plan });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const body = await req.json().catch(() => ({}));
        const findingId = String(body.finding ?? '').trim();
        const decision = body.decision;
        if (!findingId) return NextResponse.json({ error: 'A finding ID is required.' }, { status: 400 });
        if (decision !== 'approved' && decision !== 'rejected') return NextResponse.json({ error: 'decision must be "approved" or "rejected".' }, { status: 400 });
        await decideRemediationPlan(findingId, decision, user.name || user.email, typeof body.reason === 'string' ? body.reason : null);
        const plan = buildRemediationPlan(loadState(), findingId, Date.now());
        return NextResponse.json({ plan });
    } catch (err) {
        if (err instanceof PlanError) return NextResponse.json({ error: err.message }, { status: err.status });
        return authErrorResponse(err);
    }
}
