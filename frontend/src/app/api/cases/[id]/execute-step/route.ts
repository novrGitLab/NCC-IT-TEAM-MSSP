import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { recordSimulatedStep } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const stepId = String(body.step_id ?? body.step ?? 'manual_step');
        const result = await recordSimulatedStep(id, stepId, user.name || user.email);
        return NextResponse.json(result);
    } catch (err) {
        return socErrorResponse(err);
    }
}
