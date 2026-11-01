import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { createInvite, listUsers } from '@/lib/simulation/engine';
import { isConfigured, sendInviteEmail } from '@/lib/simulation/email/invites';
import type { UserRole } from '@/lib/simulation/types';

const INVITABLE_ROLES: UserRole[] = ['super_admin', 'soc_manager', 'analyst', 'executive'];

export async function GET() {
    try {
        await requireSession(['super_admin']);
        return NextResponse.json({ users: listUsers() });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const admin = await requireSession(['super_admin']);
        const body = await req.json().catch(() => ({}));
        const email = String(body.email ?? '').trim().toLowerCase();
        const role = body.role as UserRole;
        if (!email || !INVITABLE_ROLES.includes(role)) return NextResponse.json({ error: 'A valid email and role are required.' }, { status: 400 });

        const invite = await createInvite(email, role, admin.name);
        // set-password/page.tsx reads the token from the URL hash fragment (never sent to a
        // server by the browser) rather than a query string.
        const inviteUrl = `${req.nextUrl.origin}/set-password#token=${invite.token}`;

        if (!isConfigured()) {
            return NextResponse.json({ sent: false, reason: 'Brevo is not configured in this environment.', invite_url: inviteUrl });
        }
        const result = await sendInviteEmail(email, inviteUrl, role, admin.name);
        return NextResponse.json({ sent: result.sent, reason: result.reason, invite_url: result.sent ? undefined : inviteUrl });
    } catch (err) {
        return authErrorResponse(err);
    }
}
