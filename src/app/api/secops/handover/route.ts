import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { createHandoverLog, listHandoverLogs } from '@/lib/simulation/engine';

const PRIORITIES = ['Low', 'Medium', 'High'] as const;

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ logs: listHandoverLogs() });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireSession();
        const body = await req.json().catch(() => ({}));
        const analystOff = String(body.analystOff ?? '').trim();
        const analystOn = String(body.analystOn ?? '').trim();
        const shiftStart = String(body.shiftStart ?? '');
        const shiftEnd = String(body.shiftEnd ?? '');
        if (!analystOff || !analystOn) return NextResponse.json({ error: 'Both analyst names are required.' }, { status: 400 });
        if (!shiftStart || !shiftEnd || Number.isNaN(Date.parse(shiftStart)) || Number.isNaN(Date.parse(shiftEnd)) || Date.parse(shiftEnd) <= Date.parse(shiftStart)) {
            return NextResponse.json({ error: 'A valid shift window is required.' }, { status: 400 });
        }
        const watchPriority = PRIORITIES.includes(body.watchPriority) ? body.watchPriority : 'Medium';

        const log = await createHandoverLog({
            shiftStart, shiftEnd, analystOff, analystOn,
            casesReceived: Number(body.casesReceived) || 0,
            casesResolved: Number(body.casesResolved) || 0,
            casesPending: Number(body.casesPending) || 0,
            criticalCases: Array.isArray(body.criticalCases) ? body.criticalCases.map(String) : [],
            ongoingCases: Array.isArray(body.ongoingCases) ? body.ongoingCases.map(String) : [],
            watchPriority,
            watchItems: String(body.watchItems ?? ''),
            notes: String(body.notes ?? ''),
            submittedBy: user.name || user.email,
        });
        return NextResponse.json({ success: true, log });
    } catch (err) {
        return authErrorResponse(err);
    }
}
