import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { decideApproval } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

const KINDS: Record<string, 'approved' | 'rejected'> = { approve: 'approved', reject: 'rejected' };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager']);
        const { id, kind } = await params;
        const decision = KINDS[kind];
        if (!decision) return NextResponse.json({ error: 'Unknown decision.' }, { status: 404 });
        const body = await req.json().catch(() => ({}));
        const reason = typeof body.reason === 'string' ? body.reason : typeof body.note === 'string' ? body.note : null;
        const approval = await decideApproval(id, decision, user.name || user.email, reason);
        return NextResponse.json({ approval });
    } catch (err) {
        return socErrorResponse(err);
    }
}
