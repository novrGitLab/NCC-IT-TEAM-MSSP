// NCC SOC — route handler authorization guard. Every protected /api/** handler calls
// requireSession() (or requireRole()) first; a thrown AuthError maps to a 401/403 JSON response.
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { loadState } from '../store';
import { verifySessionCookie } from './session';
import type { UserRecord, UserRole } from '../types';

export const ADMIN_COOKIE = 'ncc_soc_session';
export const PORTAL_COOKIE = 'ncc_soc_portal_session';

/** Whether the session cookie should get the `Secure` flag — based on the actual connection the
 *  request arrived on, not NODE_ENV. `next start` is NODE_ENV=production whether it's serving a
 *  real HTTPS deployment or a local `http://localhost` demo/presentation run; using NODE_ENV alone
 *  marked the cookie Secure in both cases, which made browsers silently refuse to store or send it
 *  over plain HTTP — login would appear to succeed (200, token in the body) but the cookie never
 *  attached, so every subsequent page redirected back to /login. Checking the request's own
 *  protocol (and the standard reverse-proxy header, for a deployment that terminates TLS upstream
 *  of Node) fixes this for both cases without weakening it: a real HTTPS request — direct or
 *  behind a proxy — still gets a Secure cookie; only a genuinely plain-HTTP request does not. */
export function isHttpsRequest(req: NextRequest): boolean {
    if (req.headers.get('x-forwarded-proto') === 'https') return true;
    return req.nextUrl.protocol === 'https:';
}

export class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
        super(message);
        this.status = status;
    }
}

async function userFromCookie(cookieName: string): Promise<UserRecord | null> {
    const jar = await cookies();
    const value = jar.get(cookieName)?.value;
    const session = verifySessionCookie(value);
    if (!session) return null;
    const state = loadState();
    const user = state.users.find((u) => u.id === session.userId);
    if (!user || user.disabled) return null;
    return user;
}

/** Staff/admin session (any role except portal_user). */
export async function requireSession(roles?: UserRole[]): Promise<UserRecord> {
    const user = await userFromCookie(ADMIN_COOKIE);
    if (!user || user.role === 'portal_user') throw new AuthError('Not authenticated');
    if (roles && !roles.includes(user.role)) throw new AuthError('Not authorized', 403);
    return user;
}

/** Client-portal session (portal_user role, scoped to their org). */
export async function requirePortalSession(): Promise<UserRecord> {
    const user = await userFromCookie(PORTAL_COOKIE);
    if (!user || user.role !== 'portal_user') throw new AuthError('Not authenticated');
    return user;
}

/** Either kind of session, for endpoints both the admin app and the portal call the same way. */
export async function requireAnySession(): Promise<UserRecord> {
    const admin = await userFromCookie(ADMIN_COOKIE);
    if (admin) return admin;
    const portal = await userFromCookie(PORTAL_COOKIE);
    if (portal) return portal;
    throw new AuthError('Not authenticated');
}

/** Converts a thrown AuthError into the matching JSON response; rethrows anything else. */
export function authErrorResponse(err: unknown): NextResponse {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
}
