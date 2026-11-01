import { NextResponse } from 'next/server';
import { requirePortalSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getTasks } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requirePortalSession();
        return NextResponse.json({ tasks: getTasks() });
    } catch (err) {
        return authErrorResponse(err);
    }
}
