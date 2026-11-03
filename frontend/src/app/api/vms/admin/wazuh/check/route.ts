import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { listAssets } from '@ncc-it/backend/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ ok: true, agents_reporting: listAssets().filter((a) => a.wazuh_agent_id).length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
