import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getAiDiagnostic } from '@ncc-it/backend/simulation/engine';
import { runDiagnostic } from '@ncc-it/backend/simulation/ai/diagnostic';

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
