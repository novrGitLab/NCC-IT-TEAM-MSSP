import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { listUsers } from '@/lib/simulation/engine';

// Roster presence, built from the same user records the handover picker and Team page read.
// Heartbeats are not stored, so the only account shown as online is the one making this request;
// everyone else is offline with no recorded activity. Case, response-time and weekly-activity
// figures are not tracked yet, so they are reported as empty rather than estimated.
export async function GET() {
    try {
        const me = await requireSession(['super_admin', 'soc_manager', 'executive']);
        const nowIso = new Date().toISOString();
        const members = listUsers().map((u) => {
            const isMe = u.id === me.id;
            return {
                email: u.email,
                name: u.name,
                role: u.role,
                job_function: u.jobFunction ?? null,
                account_status: u.disabled ? 'disabled' : 'active',
                status: isMe ? 'online' : 'offline',
                last_active: isMe ? nowIso : null,
                active_days: [] as string[],
                cases_assigned: 0,
                avg_response_hrs: null,
                response_sample: 0,
            };
        });
        return NextResponse.json({ members, history: 'since_restart', generated_at: nowIso });
    } catch (err) {
        return authErrorResponse(err);
    }
}
