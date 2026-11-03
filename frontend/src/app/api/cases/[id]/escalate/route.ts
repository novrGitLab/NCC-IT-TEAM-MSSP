import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { escalateCase } from '@ncc-it/backend/simulation/soc-store';
import { socErrorResponse } from '@/lib/server/soc-http';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const updated = await escalateCase(id, user.name || user.email);
        return NextResponse.json({ message: 'Case escalated.', case: updated });
    } catch (err) {
        return socErrorResponse(err);
    }
}
