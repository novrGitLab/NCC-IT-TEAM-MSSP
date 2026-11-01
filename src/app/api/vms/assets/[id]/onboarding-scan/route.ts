import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { startAssetScan } from '@/lib/simulation/engine';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession(['super_admin', 'soc_manager', 'analyst']);
        const { id } = await params;
        const scan = await startAssetScan(id);
        if (!scan) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        return NextResponse.json({ scan, message: 'Scan queued — the simulation clock will progress it automatically.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
