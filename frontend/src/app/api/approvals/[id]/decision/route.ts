import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { decideApproval } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

const DECISIONS = ['approved', 'rejected', 'info_requested'] as const;
type Decision = typeof DECISIONS[number];

/** Approving or rejecting a critical response is for approvers; asking for more investigation is open to analysts. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const decision = body.decision as Decision;
        if (!DECISIONS.includes(decision)) return NextResponse.json({ error: 'decision must be approved, rejected or info_requested.' }, { status: 400 });
        if (decision !== 'info_requested' && !['super_admin', 'soc_manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Only a super admin or SOC manager can approve or reject a response request.' }, { status: 403 });
        }
        const approval = await decideApproval(id, decision, user.name || user.email, typeof body.reason === 'string' ? body.reason : null);
        return NextResponse.json({ approval });
    } catch (err) {
        return socErrorResponse(err);
    }
}
