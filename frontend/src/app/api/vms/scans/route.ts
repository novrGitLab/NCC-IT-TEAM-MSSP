import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';

export async function GET() {
    try {
        await requireSession();
        const { scans } = loadState();
        return NextResponse.json({ scans, total: scans.length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
