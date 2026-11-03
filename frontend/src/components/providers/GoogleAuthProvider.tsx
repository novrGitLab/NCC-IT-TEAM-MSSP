'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Guards against a missing/placeholder client ID (e.g. local dev before the real
// NCC IT Google Client ID is filled in) — @react-oauth/google throws once a
// GoogleLogin button actually renders under a provider with no clientId, so we
// simply skip the provider (and the buttons fall back to their onError path).
export const GoogleAuthProvider = ({ children }: { children: React.ReactNode }) => {
    if (!CLIENT_ID) return <>{children}</>;
    return <GoogleOAuthProvider clientId={CLIENT_ID}>{children}</GoogleOAuthProvider>;
};
