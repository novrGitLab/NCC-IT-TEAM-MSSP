// NCC SOC — invite emails via Brevo. Server-only: BREVO_API_KEY/BREVO_SENDER_EMAIL/
// BREVO_SENDER_NAME are read from process.env here and never reach the browser. If Brevo isn't
// configured or the send fails, the caller gets an honest "not sent" result and the invite link
// for local copy — never a false "email sent" claim.
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export function isConfigured(): boolean {
    return !!process.env.BREVO_API_KEY;
}

export interface SendInviteResult { sent: boolean; reason?: string }

export async function sendInviteEmail(to: string, inviteUrl: string, role: string, invitedByName: string): Promise<SendInviteResult> {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'NCC SOC';
    if (!apiKey || !senderEmail) return { sent: false, reason: 'Brevo is not configured in this environment.' };

    const roleLabel = role.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    try {
        const res = await fetch(BREVO_ENDPOINT, {
            method: 'POST',
            headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: senderName },
                to: [{ email: to }],
                subject: `You've been invited to NCC SOC`,
                htmlContent: `<p>${invitedByName} invited you to join NCC SOC as <strong>${roleLabel}</strong>.</p>`
                    + `<p><a href="${inviteUrl}">Accept your invitation</a></p>`
                    + `<p style="color:#64748B;font-size:12px">This is an evaluation environment — telemetry and response actions are simulated; no external assets are connected. This link expires in 7 days.</p>`,
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
