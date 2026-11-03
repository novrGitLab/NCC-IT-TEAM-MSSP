import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getCaseDetail } from '@ncc-it/backend/simulation/soc-store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        if (!getCaseDetail(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        return NextResponse.json({ report_url: null, message: 'Report export is not produced in this illustrative environment.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
