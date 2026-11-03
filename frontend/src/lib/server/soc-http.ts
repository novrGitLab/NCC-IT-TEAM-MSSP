import { NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/guard';
import { SocError } from '@ncc-it/backend/simulation/soc-store';

/** Maps SOC domain errors to their HTTP status; anything else goes through the auth error mapping. */
export function socErrorResponse(err: unknown) {
    if (err instanceof SocError) return NextResponse.json({ error: err.message }, { status: err.status });
    return authErrorResponse(err);
}
