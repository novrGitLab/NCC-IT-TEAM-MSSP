import { NextResponse } from 'next/server';

// This environment never calls a real Google OAuth client or production backend — an honest
// failure so the button doesn't lie, matching the behavior of the former demo router.
export async function POST() {
    return NextResponse.json({ error: 'Google sign-in is not available in this evaluation environment. Use the evaluation email/password shown on the login page.' }, { status: 501 });
}
