import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getAiDiagnostic } from '@/lib/simulation/engine';
import { runDiagnostic } from '@/lib/simulation/ai/diagnostic';

export async function GET() {
    try {
        await requireSession(['super_admin']);
        return NextResponse.json(getAiDiagnostic());
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST() {
    try {
        await requireSession(['super_admin']);
        const result = await runDiagnostic();
        return NextResponse.json(result);
    } catch (err) {
        return authErrorResponse(err);
    }
}
