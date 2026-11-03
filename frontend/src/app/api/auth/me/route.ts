import { NextResponse } from 'next/server';
import { requireSession, AuthError } from '@/lib/auth/guard';

export async function GET() {
    try {
        const user = await requireSession();
        return NextResponse.json({ name: user.name, email: user.email, role: user.role, company: 'NCC IT' });
    } catch (err) {
        const status = err instanceof AuthError ? err.status : 401;
        return NextResponse.json({ error: 'Not authenticated' }, { status });
    }
}
