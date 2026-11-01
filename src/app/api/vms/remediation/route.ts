import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getRemediationItems } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ items: getRemediationItems() });
    } catch (err) {
        return authErrorResponse(err);
    }
}
