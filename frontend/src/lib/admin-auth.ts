const TOKEN_KEY = 'admin_token';

export interface AdminUser {
    name: string;
    email: string;
    role: string;
    company: string;
}

export function getAdminToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function isAdminAuthenticated(): boolean {
    return getAdminToken() !== null;
}

const USER_CACHE_KEY = 'admin_user_cache';

// Display info (name/email/role) for the sidebar footer — never used for authorization, the
// session cookie checked server-side on every request is the real auth boundary. Populated by
// refreshAdminUserCache() after sign-in from GET /api/auth/me; this just reads that cache
// synchronously so existing callers don't need to become async.
export function getAdminUser(): AdminUser {
    const fallback: AdminUser = { name: 'Admin User', email: '', role: 'Administrator', company: 'NCC IT' };
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = sessionStorage.getItem(USER_CACHE_KEY);
        if (!raw) return fallback;
        const cached = JSON.parse(raw);
        return {
            name: cached.name ?? fallback.name,
            email: cached.email ?? fallback.email,
            role: cached.role ?? fallback.role,
            company: cached.company ?? fallback.company,
        };
    } catch {
        return fallback;
    }
}

/** Fetches /api/auth/me and caches it for getAdminUser(). Call once after sign-in. */
export async function refreshAdminUserCache(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const { apiFetch, apiUrl } = await import('./api');
        const res = await apiFetch(apiUrl('/api/auth/me'));
        const me = await res.json();
        if (res.ok && me?.email) sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(me));
    } catch {
        // Best-effort — the sidebar falls back to generic display text, never blocks login.
    }
}

export function adminSignOut(): void {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_CACHE_KEY);
    void import('./api').then(({ apiFetch, apiUrl }) => apiFetch(apiUrl('/api/auth/signout'), { method: 'POST' })).catch(() => {});
    window.location.href = '/login';
}
