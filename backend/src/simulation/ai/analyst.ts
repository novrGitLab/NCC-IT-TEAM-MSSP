// NCC IT — AI analyst. Server-only: NVIDIA_API_KEY/NVIDIA_MODEL are read from process.env here
// and never reach the browser. The model is given only real records resolved from the simulation
// engine (or the still-unported demo fixtures, for subject types not yet migrated) and is
// instructed never to invent facts beyond what it was given. User-triggered only — nothing here
// runs on a timer or on every page render.
import { getAiDiagnostic, getAssetDetail, findingDetail, findingsForAsset, getRisk } from '../engine';
import { getAlert, getCaseDetail } from '../soc-store';
import { buildWeeklyFacts } from '../insights';
import { loadState } from '../store';

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 700;

// Per-process, per-session request cap — fine for the single-instance evaluation deployment this
// is built for (see store.ts's own documented limitation); resets when the server restarts.
const RATE_LIMIT_PER_SESSION = 30;
const requestCounts = new Map<string, number>();

export function isConfigured(): boolean {
    return !!process.env.NVIDIA_API_KEY;
}

export class AiNotAvailableError extends Error {}
export class RateLimitedError extends Error {}

export function checkRateLimit(sessionId: string): void {
    const count = requestCounts.get(sessionId) ?? 0;
    if (count >= RATE_LIMIT_PER_SESSION) throw new RateLimitedError('AI analysis request limit reached for this session.');
    requestCounts.set(sessionId, count + 1);
}

export interface Subject { label: string; data: unknown }

// Mirrors AiPanel.tsx's client-side SUBJECT map — the client only sends `purpose` + `subject_id`
// to POST /api/ai/generate, so the server derives subject type from purpose the same way.
export const PURPOSE_TO_SUBJECT_TYPE: Record<string, string> = {
    alert_summary: 'alert', case_summary: 'case', case_handover: 'case', incident_report: 'case',
    finding_explanation: 'finding', remediation_plan: 'finding', rescan_interpretation: 'finding', asset_assessment: 'asset',
    indicator_assessment: 'indicator', threat_briefing: 'report', weekly_insights: 'report', investigation_summary: 'indicator',
};

/** Resolves a (subjectType, subjectId) pair to real records the model may cite. Never invented. */
export function resolveSubject(subjectType: string, subjectId: string): Subject | null {
    switch (subjectType) {
        case 'asset': {
            const detail = getAssetDetail(subjectId);
            if (!detail) return null;
            return { label: detail.asset.value, data: { ...detail, findings: findingsForAsset(subjectId) } };
        }
        case 'finding': {
            const detail = findingDetail(subjectId);
            if (!detail) return null;
            const queueEntry = getRisk().queue.find((q) => q.id === subjectId) ?? null;
            const asset = detail.finding.asset_id ? getAssetDetail(detail.finding.asset_id) : null;
            return { label: detail.finding.title, data: { ...detail, priority_factors: queueEntry?.factors ?? null, asset: asset?.asset ?? null } };
        }
        case 'alert': {
            const alert = getAlert(subjectId);
            return alert ? { label: alert.rule_description ?? alert.id, data: alert } : null;
        }
        case 'case': {
            const detail = getCaseDetail(subjectId);
            return detail ? { label: detail.case.title, data: detail } : null;
        }
        case 'indicator': {
            // Threat-intelligence records are not in the shared state yet, so they cannot be cited.
            return null;
        }
        case 'report': {
            if (subjectId === 'weekly-insights') return { label: 'Weekly insights', data: buildWeeklyFacts(loadState(), 7, Date.now()) };
            return null;
        }
        default:
            return null;
    }
}

const PURPOSE_INSTRUCTIONS: Record<string, string> = {
    finding_explanation: 'Explain in plain language why this finding matters and how urgent it is. Output JSON: {"summary": string, "risk_factors": string[]}.',
    remediation_plan: 'Propose concrete remediation steps for this finding, grounded only in its own remediation guidance and description. Output JSON: {"summary": string, "recommended_actions": [{"action": string, "requires_approval": boolean}]}.',
    rescan_interpretation: 'Interpret this finding\'s current status as if reviewing a rescan result. Output JSON: {"summary": string, "outcome": string}.',
    asset_assessment: 'Summarize this asset\'s exposure and why it is risk-ranked as it is, citing its own findings only. Output JSON: {"summary": string, "exposure_factors": string[]}.',
    alert_summary: 'Summarize this security alert and suggest next investigation steps. Output JSON: {"summary": string, "recommended_next_steps": string[]}.',
    case_summary: 'Summarize this case\'s current state for a handover. Output JSON: {"summary": string, "timeline_highlights": string[]}.',
    case_handover: 'Write a shift-handover summary of this case. Output JSON: {"summary": string, "timeline_highlights": string[]}.',
    incident_report: 'Draft an executive-style incident summary for this case. Output JSON: {"summary": string, "timeline_highlights": string[]}.',
    indicator_assessment: 'Assess this threat indicator\'s relevance and confidence. Output JSON: {"summary": string, "confidence": string}.',
    investigation_summary: 'Summarize the investigation status of this indicator. Output JSON: {"summary": string, "confidence": string}.',
    threat_briefing: 'Write a brief threat summary from this report data. Output JSON: {"summary": string, "key_points": string[]}.',
    weekly_insights: 'Summarize this week\'s security insights. Output JSON: {"summary": string, "key_points": string[]}.',
};

function buildMessages(purpose: string, subject: Subject): { role: string; content: string }[] {
    const instruction = PURPOSE_INSTRUCTIONS[purpose] ?? 'Summarize the given record. Output JSON: {"summary": string}.';
    return [
        {
            role: 'system',
            content: 'You are a security analyst assistant embedded in NCC IT, an evaluation platform running entirely on simulated data. '
                + 'You will be given one real JSON record from this simulation and asked to analyze it. '
                + 'Use ONLY the facts present in the given record — never invent CVEs, IP addresses, dates, people, or events that are not present in it. '
                + 'If the record lacks information needed for a confident answer, say so explicitly rather than guessing. '
                + 'Reply with a single valid JSON object and nothing else — no markdown fences, no commentary outside the JSON.',
        },
        {
            role: 'user',
            content: `${instruction}\n\nRecord (subject: ${subject.label}):\n${JSON.stringify(subject.data, null, 2)}`,
        },
    ];
}

function parseModelJson(raw: string): Record<string, unknown> {
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch {
                // fall through
            }
        }
        throw new Error('Model response was not valid JSON');
    }
}

export async function generate(purpose: string, subject: Subject): Promise<{ content: Record<string, unknown>; model: string }> {
    const apiKey = process.env.NVIDIA_API_KEY;
    // Prefer the model the diagnostic (src/lib/simulation/ai/diagnostic.ts) actually verified
    // works on this account over the raw env var, which may be stale or invalid — additive only,
    // falls back to NVIDIA_MODEL unchanged when no diagnostic has run yet.
    const model = getAiDiagnostic().verifiedModel ?? process.env.NVIDIA_MODEL;
    if (!apiKey || !model) throw new AiNotAvailableError('AI is not configured in this environment.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(NVIDIA_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: buildMessages(purpose, subject),
                max_tokens: MAX_OUTPUT_TOKENS,
                temperature: 0.2,
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new AiNotAvailableError(`AI provider returned an error (HTTP ${res.status}). ${text.slice(0, 200)}`);
        }
        const json = await res.json();
        const raw = json?.choices?.[0]?.message?.content;
        if (typeof raw !== 'string') throw new AiNotAvailableError('AI provider returned an empty response.');
        return { content: parseModelJson(raw), model };
    } catch (err) {
        if (err instanceof AiNotAvailableError) throw err;
        if (err instanceof Error && err.name === 'AbortError') throw new AiNotAvailableError('AI provider timed out.');
        throw new AiNotAvailableError(err instanceof Error ? err.message : 'AI provider request failed.');
    } finally {
        clearTimeout(timeout);
    }
}
