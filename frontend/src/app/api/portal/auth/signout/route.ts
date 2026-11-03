import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@ncc-it/backend/simulation/auth/session';
import { PORTAL_COOKIE } from '@/lib/auth/guard';

export async function POST(req: NextRequest) {
    const cookie = req.cookies.get(PORTAL_COOKIE)?.value;
    await destroySession(cookie);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PORTAL_COOKIE);
    return res;
}
