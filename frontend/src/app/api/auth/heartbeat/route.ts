import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';

async function respond() {
    try {
        await requireSession();
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 401 });
    }
}

export const GET = respond;
// PresenceHeartbeat.tsx POSTs here every 2 minutes (and on visibility change) with
// { visible, state? } to drive Settings -> Team's online/away/offline presence — that body isn't
// persisted yet (team presence still reads from the fixture layer's /api/admin/team/presence),
// but this must still answer 200/401 rather than 405 so the keepalive beat doesn't error.
export const POST = respond;
