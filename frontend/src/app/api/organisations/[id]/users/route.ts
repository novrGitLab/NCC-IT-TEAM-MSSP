import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { createInvite, getOrganisation } from '@ncc-it/backend/simulation/engine';
import { isDeliveryEnabled, LOCAL_ONLY_REASON, sendInviteEmail } from '@ncc-it/backend/simulation/email/invites';
import type { UserRole } from '@ncc-it/backend/simulation/types';

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
        if (!isDeliveryEnabled()) {
            return NextResponse.json({ ok: true, delivery: 'recorded', message: LOCAL_ONLY_REASON });
        }
        const inviteUrl = `${req.nextUrl.origin}/set-password#token=${invite.token}`;
        const result = await sendInviteEmail(email, inviteUrl, role, admin.name).catch(() => ({ sent: false, reason: 'Delivery failed.' }));
        return NextResponse.json({
            ok: true,
            delivery: result.sent ? 'delivered' : 'recorded',
            message: result.sent ? 'Invitation email delivered.' : `Invitation recorded; no email was delivered${result.reason ? ` (${result.reason})` : ''}.`,
        });
    } catch (err) {
        return authErrorResponse(err);
    }
}
