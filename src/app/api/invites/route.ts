import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { createInvite, listUsers } from '@/lib/simulation/engine';
import { isConfigured, sendInviteEmail } from '@/lib/simulation/email/invites';
import { isJobFunction, JOB_FUNCTIONS, sanitizeScope, type JobFunction } from '@/lib/team/invite-functions';

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
        if (!email) return NextResponse.json({ error: 'An email address is required.' }, { status: 400 });
        if (!isJobFunction(body.jobFunction)) return NextResponse.json({ error: 'A valid job function is required.' }, { status: 400 });

        const fn: JobFunction = body.jobFunction;
        const scoped = sanitizeScope(fn, body.scope);
        if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: 400 });

        const def = JOB_FUNCTIONS[fn];
        const invite = await createInvite(email, def.role, admin.name, null, fn, scoped.scope);
        // set-password/page.tsx reads the token from the URL hash fragment (never sent to a
        // server by the browser) rather than a query string.
        const inviteUrl = `${req.nextUrl.origin}/set-password#token=${invite.token}`;

        if (!isConfigured()) {
            return NextResponse.json({ sent: false, reason: 'Brevo is not configured in this environment.', invite_url: inviteUrl, invite: { email, jobFunction: fn, role: def.role, scope: scoped.scope } });
        }
        const result = await sendInviteEmail(email, inviteUrl, def.role, admin.name);
        return NextResponse.json({ sent: result.sent, reason: result.reason, invite_url: result.sent ? undefined : inviteUrl, invite: { email, jobFunction: fn, role: def.role, scope: scoped.scope } });
    } catch (err) {
        return authErrorResponse(err);
    }
}
