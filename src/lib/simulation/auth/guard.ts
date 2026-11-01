// NCC SOC — route handler authorization guard. Every protected /api/** handler calls
// requireSession() (or requireRole()) first; a thrown AuthError maps to a 401/403 JSON response.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { loadState } from '../store';
import { verifySessionCookie } from './session';
import type { UserRecord, UserRole } from '../types';

export const ADMIN_COOKIE = 'ncc_soc_session';
export const PORTAL_COOKIE = 'ncc_soc_portal_session';

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
