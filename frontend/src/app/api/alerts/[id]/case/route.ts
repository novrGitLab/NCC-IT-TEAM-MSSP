import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { attachAlertToCase } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const result = await attachAlertToCase(id, user.name || user.email);
        return NextResponse.json({ case_id: result.case_id, created: result.created, message: result.created ? 'Case opened for this alert.' : 'Alert already belongs to a case.' });
    } catch (err) {
        return socErrorResponse(err);
    }
}
