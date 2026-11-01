import { NextRequest, NextResponse } from 'next/server';
import { acceptInvite, getInvite, InviteError } from '@/lib/simulation/engine';

function nameFromEmail(email: string): string {
    const local = email.split('@')[0] ?? email;
    return local.split(/[._-]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') || email;
}

// Public — the token itself (43 random bytes of entropy, single-use, 7-day expiry) is the
// credential here, same model as any email-based invite/reset link.
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? '');
    const password = String(body.password ?? '');
    if (!token || password.length < 12) return NextResponse.json({ error: 'A token and a password of at least 12 characters are required.' }, { status: 400 });

    const invite = getInvite(token);
    if (!invite) return NextResponse.json({ error: 'Invitation not found or expired.' }, { status: 400 });

    try {
        const user = await acceptInvite(token, password, nameFromEmail(invite.email));
        return NextResponse.json({ email: user.email, portal: false });
    } catch (err) {
        if (err instanceof InviteError) return NextResponse.json({ error: err.message }, { status: 400 });
        return NextResponse.json({ error: 'Could not set the password.' }, { status: 500 });
    }
}
