import { NextRequest, NextResponse } from 'next/server';
import { loadState } from '@/lib/simulation/store';
import { verifyPassword } from '@/lib/simulation/auth/users';
import { createSession } from '@/lib/simulation/auth/session';
import { ADMIN_COOKIE } from '@/lib/simulation/auth/guard';

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    const state = loadState();
    const user = state.users.find((u) => u.email === email && u.role !== 'portal_user' && !u.disabled);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { cookieValue } = await createSession(user.id);
    const res = NextResponse.json({ token: cookieValue });
    res.cookies.set(ADMIN_COOKIE, cookieValue, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 3600 });
    return res;
}
