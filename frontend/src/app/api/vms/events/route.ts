import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ events: loadState().events });
    } catch (err) {
        return authErrorResponse(err);
    }
}
