import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/simulation/auth/guard';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 401 });
    }
}
