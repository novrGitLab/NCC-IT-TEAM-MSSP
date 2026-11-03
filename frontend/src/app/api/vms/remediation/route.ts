import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getRemediationItems } from '@ncc-it/backend/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ items: getRemediationItems() });
    } catch (err) {
        return authErrorResponse(err);
    }
}
