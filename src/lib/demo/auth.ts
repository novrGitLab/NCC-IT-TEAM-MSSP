// NovaSOC NCC — local demo authentication. No production backend, no Supabase, no Google OAuth
// server call. Credentials are compared against NEXT_PUBLIC_DEMO_ADMIN_EMAIL/PASSWORD (public by
// necessity — this is a client-side-only demo gate, never a real auth boundary).

function b64(obj: unknown): string {
    // btoa is UTF-16-unsafe for non-Latin1 text; demo payloads are plain ASCII, so this is fine.
    return btoa(JSON.stringify(obj)).replace(/=+$/, '');
}

/** An unsigned, JWT-shaped token: header.payload.signature. Decoded for display only, matching
 *  how admin-auth.ts / portal-auth.ts already read tokens in the source app (never verified). */
function mintToken(payload: Record<string, unknown>): string {
    return `${b64({ alg: 'none', typ: 'demo' })}.${b64(payload)}.demo-signature`;
}

export const DEMO_ADMIN_EMAIL = process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || 'demo@novasoc-ncc.local';
export const DEMO_ADMIN_PASSWORD = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || 'demo1234';

export function checkDemoCredentials(email: string, password: string): boolean {
    return email.trim().toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase() && password === DEMO_ADMIN_PASSWORD;
}

export function mintAdminToken() {
    return mintToken({ name: 'Demo Administrator', email: DEMO_ADMIN_EMAIL, role: 'super_admin', company: 'NovaSOC NCC (Demo)' });
}

export function mintPortalToken() {
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600; // 12h demo session
    return mintToken({ exp, sub: 'portal-demo-user' });
}

export const DEMO_PORTAL_USER = {
    userId: 'portal-demo-user',
    name: 'Demo Client Contact',
    email: DEMO_ADMIN_EMAIL,
    orgId: 1,
    orgName: 'NovaSOC NCC Demo Org',
    orgIndustry: 'Telecommunications',
    orgPlan: 'Evaluation',
    portalRole: 'portal_user',
    wazuhGroup: null as string | null,
};
