import { NextRequest, NextResponse } from 'next/server';
import { loadState } from '@ncc-it/backend/simulation/store';
import { verifyPassword } from '@ncc-it/backend/simulation/auth/users';
import { createSession } from '@ncc-it/backend/simulation/auth/session';
import { PORTAL_COOKIE, isHttpsRequest } from '@/lib/auth/guard';

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    const state = loadState();
    const user = state.users.find((u) => u.email === email && u.role === 'portal_user' && !u.disabled);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ error: 'Invalid credentials. Contact your security team.' }, { status: 401 });
    }
    const org = state.organisations.find((o) => o.id === user.orgId);

    const { cookieValue } = await createSession(user.id);
    const res = NextResponse.json({
        token: cookieValue,
        user: {
            userId: user.id, name: user.name, email: user.email,
            orgId: org?.id ?? null, orgName: org?.name ?? null, orgIndustry: org?.industry ?? null, orgPlan: org?.plan ?? null,
            portalRole: 'portal_user', wazuhGroup: org?.wazuh_group ?? null,
        },
    });
    res.cookies.set(PORTAL_COOKIE, cookieValue, { httpOnly: true, secure: isHttpsRequest(req), sameSite: 'lax', path: '/', maxAge: 12 * 3600 });
    return res;
}
