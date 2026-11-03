// NCC IT — HMAC-signed opaque session cookies. Session authority (userId, expiry) lives in
// SimState.sessions; the cookie itself is just `sessionId.hmac` so a forged/guessed id without the
// right HMAC is rejected before ever touching the store, and signing out deletes the store record
// immediately (unlike a self-contained JWT, which can't be revoked before it expires).
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { loadState, saveState } from '../store';
import type { SessionRecord } from '../types';

const SESSION_TTL_MS = 12 * 3600 * 1000; // 12h

function secret(): string {
    const s = process.env.SESSION_SECRET;
    if (!s) throw new Error('SESSION_SECRET is not set — see .env.example');
    return s;
}

function sign(sessionId: string): string {
    return createHmac('sha256', secret()).update(sessionId).digest('hex');
}

export function encodeCookie(sessionId: string): string {
    return `${sessionId}.${sign(sessionId)}`;
}

function decodeCookie(cookieValue: string): string | null {
    const dot = cookieValue.lastIndexOf('.');
    if (dot < 0) return null;
    const sessionId = cookieValue.slice(0, dot);
    const mac = cookieValue.slice(dot + 1);
    const expected = sign(sessionId);
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return sessionId;
}

export async function createSession(userId: string): Promise<{ cookieValue: string; record: SessionRecord }> {
    const record: SessionRecord = {
        id: randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
    await saveState((draft) => { draft.sessions.push(record); });
    return { cookieValue: encodeCookie(record.id), record };
}

/** Verifies the cookie's signature, then looks up the session record — rejecting it if expired. */
export function verifySessionCookie(cookieValue: string | undefined | null): SessionRecord | null {
    if (!cookieValue) return null;
    const sessionId = decodeCookie(cookieValue);
    if (!sessionId) return null;
    const state = loadState();
    const record = state.sessions.find((s) => s.id === sessionId);
    if (!record) return null;
    if (Date.parse(record.expiresAt) < Date.now()) return null;
    return record;
}

export async function destroySession(cookieValue: string | undefined | null): Promise<void> {
    const sessionId = cookieValue ? decodeCookie(cookieValue) : null;
    if (!sessionId) return;
    await saveState((draft) => { draft.sessions = draft.sessions.filter((s) => s.id !== sessionId); });
}
