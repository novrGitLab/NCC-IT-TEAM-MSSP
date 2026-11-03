import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { createInvite, listUsers } from '@ncc-it/backend/simulation/engine';
import { isDeliveryEnabled, LOCAL_ONLY_REASON, sendInviteEmail } from '@ncc-it/backend/simulation/email/invites';
import { isJobFunction, JOB_FUNCTIONS, sanitizeScope, type JobFunction } from '@ncc-it/backend/contracts/invite-functions';

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
        const summary = { email, jobFunction: fn, role: def.role, scope: scoped.scope };

        // Delivery is opt-in for production only (src/lib/simulation/email/invites.ts). When it is
        // off, Brevo is never contacted and the invitation is only the local record and its link.
        if (!isDeliveryEnabled()) {
            return NextResponse.json({ delivery: 'recorded', sent: false, reason: LOCAL_ONLY_REASON, invite_url: inviteUrl, invite: summary });
        }
        const result = await sendInviteEmail(email, inviteUrl, def.role, admin.name);
        return NextResponse.json({
            delivery: result.sent ? 'delivered' : 'recorded',
            sent: result.sent,
            reason: result.reason,
            invite_url: result.sent ? undefined : inviteUrl,
            invite: summary,
        });
    } catch (err) {
        return authErrorResponse(err);
    }
}
