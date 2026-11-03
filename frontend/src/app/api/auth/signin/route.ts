import { NextRequest, NextResponse } from 'next/server';
import { loadState } from '@ncc-it/backend/simulation/store';
import { verifyPassword } from '@ncc-it/backend/simulation/auth/users';
import { createSession } from '@ncc-it/backend/simulation/auth/session';
import { ADMIN_COOKIE, isHttpsRequest } from '@/lib/auth/guard';

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
    res.cookies.set(ADMIN_COOKIE, cookieValue, { httpOnly: true, secure: isHttpsRequest(req), sameSite: 'lax', path: '/', maxAge: 12 * 3600 });
    return res;
}
