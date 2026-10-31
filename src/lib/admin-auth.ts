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

// Best-effort decode of the admin JWT payload for display purposes only (name/email/role
// in the sidebar footer) — never used for authorization, the backend is the source of truth.
export function getAdminUser(): AdminUser {
    const fallback: AdminUser = { name: 'Admin User', email: '', role: 'Administrator', company: 'NovaSOC NCC' };
    const token = getAdminToken();
    if (!token) return fallback;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            name: payload.name ?? fallback.name,
            email: payload.email ?? fallback.email,
            role: payload.role ?? fallback.role,
            company: payload.company ?? fallback.company,
        };
    } catch {
        return fallback;
    }
}

export function adminSignOut(): void {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
}
