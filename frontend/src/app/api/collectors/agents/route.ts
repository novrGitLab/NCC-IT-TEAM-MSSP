import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { listAgentPackages } from '@ncc-it/backend/simulation/agent-packages';

/** Package targets and whether each one is currently offered, with the reason when it is not. */
export async function GET() {
    try {
        await requireSession();
        return NextResponse.json(listAgentPackages());
    } catch (err) {
        return authErrorResponse(err);
    }
}
