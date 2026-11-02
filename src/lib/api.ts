import { getAuthToken } from './account';
import { adminSignOut } from './admin-auth';
import { portalSignOut } from './portal-auth';
import { vmsOrgHeaderFor } from './vmsOrg';
import { demoRespond } from './demo/router';

// NCC SOC is being migrated off the in-memory demo router onto real route handlers backed by the
// persistent simulation engine (src/lib/simulation/). apiUrl() still returns a same-origin-shaped
// URL so relative-path logic elsewhere keeps working. apiFetch() now branches: paths that have
// been ported to a real src/app/api/**/route.ts (isPortedPath below) get a real same-origin
// fetch() with the session cookie attached; everything else still goes through demoRespond()
// (src/lib/demo/router.ts) exactly as before, until it's ported too. This keeps every calling
// page/hook unmodified throughout the migration — same Response-shaped object back either way.
export function apiUrl(path: string): string {
    return `https://demo.ncc-soc.local${path}`;
}

const PORTED_EXACT = new Set([
    '/api/auth/signin', '/api/auth/signout', '/api/auth/heartbeat', '/api/auth/me', '/api/auth/google', '/api/auth/set-password',
    '/api/portal/status', '/api/portal/auth/signin', '/api/portal/auth/signout',
    '/api/vms/dashboard', '/api/vms/overview', '/api/vms/assets', '/api/vms/findings', '/api/vms/findings/summary',
    '/api/vms/scans', '/api/vms/risk', '/api/vms/remediation', '/api/vms/tasks',
    '/api/vms/events', '/api/vms/endpoints', '/api/vms/report', '/api/vms/admin/status', '/api/vms/admin/wazuh/check', '/api/vms/eligibility/refresh',
    '/api/client/vms/summary', '/api/client/vms/assets', '/api/client/vms/tasks',
    '/api/ti/sources',
    '/api/ai/generate', '/api/ai/artifacts', '/api/ai/diagnostic',
    '/api/invites',
    '/api/organisations', '/api/admin/collectors', '/api/collectors', '/api/posture/summary',
    '/api/secops/handover', '/api/secops/team', '/api/admin/team/presence',
]);
const PORTED_PATTERNS = [
    /^\/api\/vms\/assets\/[^/]+$/, /^\/api\/vms\/assets\/[^/]+\/graph$/, /^\/api\/vms\/assets\/[^/]+\/onboarding-scan$/,
    /^\/api\/vms\/findings\/[^/]+$/, /^\/api\/vms\/findings\/[^/]+\/tasks$/,
    /^\/api\/vms\/tasks\/[^/]+$/,
    /^\/api\/ai\/artifacts\/[^/]+\/feedback$/,
    /^\/api\/organisations\/[^/]+$/, /^\/api\/organisations\/[^/]+\/setup$/, /^\/api\/organisations\/[^/]+\/users$/,
    /^\/api\/collectors\/[^/]+$/, /^\/api\/collectors\/[^/]+\/events$/,
    /^\/api\/posture\/[^/]+$/,
];

/** True once a path's src/app/api/**\/route.ts handler exists — see the route migration plan. */
function isPortedPath(path: string): boolean {
    return PORTED_EXACT.has(path) || PORTED_PATTERNS.some((re) => re.test(path));
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = getAuthToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // VMS pages viewing another organisation (lib/vmsOrg.ts) — harmless to keep computing even
    // for demo-router paths; avoids drifting from the source call shape.
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

    let res: Response;
    if (isPortedPath(path)) {
        const qs = query.toString();
        const relativeUrl = qs ? `${path}?${qs}` : path;
        res = await fetch(relativeUrl, { ...init, credentials: 'include', headers });
    } else {
        const { status, data } = demoRespond(method, path, query, init.body);
        res = new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    }

    if (res.status === 401) {
        // Prefer whichever session actually looks active — a portal user hitting a
        // newly-protected route should land back on the portal login, not the admin one.
        if (typeof window !== 'undefined' && localStorage.getItem('portal_token')) portalSignOut();
        else if (typeof window !== 'undefined' && localStorage.getItem('admin_token')) adminSignOut();
    }

    return res;
}
