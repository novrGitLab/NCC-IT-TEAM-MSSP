import { getAuthToken } from './account';
import { adminSignOut } from './admin-auth';
import { portalSignOut } from './portal-auth';
import { vmsOrgHeaderFor } from './vmsOrg';
import { demoRespond } from './demo/router';

// NovaSOC NCC is frontend-only and intentionally never calls a production backend. apiUrl()
// still returns a same-origin-shaped URL (so relative-path logic elsewhere keeps working), but
// apiFetch() below never actually sends it anywhere — every call is answered locally from
// src/lib/demo/router.ts. There is deliberately no NEXT_PUBLIC_BACKEND_URL in this project.
export function apiUrl(path: string): string {
    return `https://demo.novasoc-ncc.local${path}`;
}

// Drop-in replacement for fetch() against apiUrl() targets. In the source NovaSOC NCC app this sent
// a real HTTP request with a Bearer token; here it is the single interception point for the demo
// data layer — every request is answered from demoRespond() (src/lib/demo/router.ts) instead of
// reaching any network. This keeps every calling page/hook unmodified: same Response-shaped
// object back, same .ok/.status/.json() contract, same 401 sign-out handling.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = getAuthToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // VMS pages viewing another organisation (lib/vmsOrg.ts) — harmless to keep computing even
    // though there is no backend to audit it; avoids drifting from the source call shape.
    const org = vmsOrgHeaderFor(input);
    if (org && !headers.has('X-Org-Id')) headers.set('X-Org-Id', org);

    let path = input;
    let query = new URLSearchParams();
    try {
        const url = new URL(input);
        path = url.pathname;
        query = url.searchParams;
    } catch {
        const [p, q] = input.split('?');
        path = p;
        query = new URLSearchParams(q ?? '');
    }

    const method = (init.method ?? 'GET').toUpperCase();
    const { status, data } = demoRespond(method, path, query, init.body);
    const res = new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (res.status === 401) {
        // Prefer whichever session actually looks active — a portal user hitting a
        // newly-protected route should land back on the portal login, not the admin one.
        if (typeof window !== 'undefined' && localStorage.getItem('portal_token')) portalSignOut();
        else if (typeof window !== 'undefined' && localStorage.getItem('admin_token')) adminSignOut();
    }

    return res;
}
