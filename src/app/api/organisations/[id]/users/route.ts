import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { createInvite, getOrganisation } from '@/lib/simulation/engine';
import { isConfigured, sendInviteEmail } from '@/lib/simulation/email/invites';
import type { UserRole } from '@/lib/simulation/types';

const VALID_ROLES: UserRole[] = ['super_admin', 'soc_manager', 'analyst', 'executive', 'portal_user'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await requireSession(['super_admin', 'soc_manager', 'executive']);
        const { id } = await params;
        const org = getOrganisation(id);
        if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

        const body = await req.json().catch(() => ({}));
        const email = String(body.email ?? '').trim().toLowerCase();
        const role = (VALID_ROLES.includes(body.role) ? body.role : 'portal_user') as UserRole;
        if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

        const invite = await createInvite(email, role, admin.name, role === 'portal_user' ? org.id : null);
        if (isConfigured()) {
            const inviteUrl = `${req.nextUrl.origin}/set-password#token=${invite.token}`;
            await sendInviteEmail(email, inviteUrl, role, admin.name).catch(() => null);
        }
        return NextResponse.json({ ok: true, message: 'Team member invited and persisted to this organisation.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
