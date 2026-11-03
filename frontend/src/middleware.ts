// NCC IT — cheap unauthenticated redirect so protected pages don't flash before client-side JS
// catches up. This only checks cookie PRESENCE (edge-safe, no filesystem access to the
// simulation state); every route handler still verifies the session fully via requireSession()/
// requirePortalSession() (src/lib/simulation/auth/guard.ts).
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE = 'ncc_soc_session';
const PORTAL_COOKIE = 'ncc_soc_portal_session';

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (pathname.startsWith('/admin')) {
        if (!req.cookies.has(ADMIN_COOKIE)) {
            const url = req.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('next', pathname);
            return NextResponse.redirect(url);
        }
    }

    if (pathname.startsWith('/client') && pathname !== '/client/login') {
        if (!req.cookies.has(PORTAL_COOKIE)) {
            const url = req.nextUrl.clone();
            url.pathname = '/client/login';
            url.searchParams.set('next', pathname);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/client/:path*'],
};
