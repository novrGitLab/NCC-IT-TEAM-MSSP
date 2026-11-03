// NCC IT — invite delivery via Brevo. Server-only: BREVO_API_KEY and BREVO_SENDER_* are read from
// process.env here and never reach the browser.
//
// Delivery is OFF by default. It runs only when all of these hold:
//   NODE_ENV === 'production'  AND  BREVO_DELIVERY_ENABLED === 'true'
//   AND BREVO_API_KEY and BREVO_SENDER_EMAIL are set.
// Otherwise sendInviteEmail() returns before any network call, and the invitation exists only as a
// local record with its link. Presentation and local development never reach Brevo.
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export const LOCAL_ONLY_REASON = 'Recorded locally. External email delivery is disabled in this environment, so no email was sent.';

export function isDeliveryEnabled(): boolean {
    return process.env.NODE_ENV === 'production'
        && process.env.BREVO_DELIVERY_ENABLED === 'true'
        && !!process.env.BREVO_API_KEY
        && !!process.env.BREVO_SENDER_EMAIL;
}

export interface SendInviteResult { sent: boolean; reason?: string }

export async function sendInviteEmail(to: string, inviteUrl: string, role: string, invitedByName: string): Promise<SendInviteResult> {
    if (!isDeliveryEnabled()) return { sent: false, reason: LOCAL_ONLY_REASON };

    const apiKey = process.env.BREVO_API_KEY as string;
    const senderEmail = process.env.BREVO_SENDER_EMAIL as string;
    const senderName = process.env.BREVO_SENDER_NAME || 'NCC IT';

    const roleLabel = role.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    try {
        const res = await fetch(BREVO_ENDPOINT, {
            method: 'POST',
            headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: senderName },
                to: [{ email: to }],
                subject: `You've been invited to NCC IT`,
                htmlContent: `<p>${invitedByName} invited you to join NCC IT as <strong>${roleLabel}</strong>.</p>`
                    + `<p><a href="${inviteUrl}">Accept your invitation</a></p>`
                    + `<p style="color:#64748B;font-size:12px">This link expires in 7 days.</p>`,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { sent: false, reason: `Brevo returned HTTP ${res.status}. ${text.slice(0, 200)}` };
        }
        return { sent: true };
    } catch (err) {
        return { sent: false, reason: err instanceof Error ? err.message : 'Brevo request failed.' };
    }
}
