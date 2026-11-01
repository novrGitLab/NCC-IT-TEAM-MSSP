import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/simulation/auth/session';
import { PORTAL_COOKIE } from '@/lib/simulation/auth/guard';

export async function POST(req: NextRequest) {
    const cookie = req.cookies.get(PORTAL_COOKIE)?.value;
    await destroySession(cookie);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PORTAL_COOKIE);
    return res;
}
