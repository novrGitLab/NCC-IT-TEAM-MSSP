import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listAssets } from '@/lib/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ endpoints: listAssets().filter((a) => a.asset_type === 'endpoint') });
    } catch (err) {
        return authErrorResponse(err);
    }
}
