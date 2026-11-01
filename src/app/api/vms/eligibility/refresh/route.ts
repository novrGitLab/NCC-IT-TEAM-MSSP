import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listAssets } from '@/lib/simulation/engine';

export async function POST() {
    try {
        await requireSession();
        return NextResponse.json({ message: 'Eligibility re-check is simulated — no real Wazuh call was made.', refreshed: listAssets().filter((a) => a.wazuh_agent_id).length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
