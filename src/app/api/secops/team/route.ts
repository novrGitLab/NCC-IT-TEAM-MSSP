import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listUsers } from '@/lib/simulation/engine';

// Any signed-in admin-app user (not just super_admin) can see who else is on the team — used by
// the shift-handover "coming on" picker and the SOC Management overview. /api/invites keeps the
// super_admin-only restriction since that one can also send invitations.
export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ members: listUsers() });
    } catch (err) {
        return authErrorResponse(err);
    }
}
