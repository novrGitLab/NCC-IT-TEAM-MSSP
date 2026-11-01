// NCC SOC — NVIDIA model diagnostic (P1 Step 9). The existing AI analyst (analyst.ts) is not
// rewritten by this file; it only discovers which model id this NVIDIA account can actually
// invoke and stores it (src/lib/simulation/engine.ts's aiDiagnostic), which analyst.ts then
// prefers over the raw NVIDIA_MODEL env var. Bounded: tries a small, fixed list of candidates
// once per invocation — never retries in a loop, never runs automatically.
import { setAiDiagnostic } from '../engine';
import type { AiDiagnosticResult } from '../types';

const MODELS_ENDPOINT = 'https://integrate.api.nvidia.com/v1/models';
const CHAT_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MAX_CANDIDATES = 6;
const PROBE_TIMEOUT_MS = 15_000;

/** Chat-capable-looking, general-purpose instruct models, roughly in order of preference. The
 *  account's actual catalog is fetched live — this list only picks which of *those* results to
 *  try first; anything not in the live catalog is skipped before ever being probed. */
const PREFERRED_PATTERNS = [/nemotron.*instruct/i, /nemotron-3/i, /instruct/i, /gpt-oss/i, /chat/i];

async function fetchCatalog(apiKey: string): Promise<string[]> {
    const res = await fetch(MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`Could not list models (HTTP ${res.status}).`);
    const json = await res.json();
    const ids: string[] = Array.isArray(json?.data) ? json.data.map((m: { id: string }) => m.id) : [];
    if (!ids.length) throw new Error('This account\'s model catalog is empty or in an unexpected shape.');
    return ids;
}

function rankCandidates(ids: string[]): string[] {
    const scored = ids.map((id) => ({ id, rank: PREFERRED_PATTERNS.findIndex((p) => p.test(id)) }));
    scored.sort((a, b) => {
        const ar = a.rank === -1 ? PREFERRED_PATTERNS.length : a.rank;
        const br = b.rank === -1 ? PREFERRED_PATTERNS.length : b.rank;
        return ar - br;
    });
    return scored.map((s) => s.id).slice(0, MAX_CANDIDATES);
}

async function probe(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const res = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 5 }),
            signal: controller.signal,
        });
        if (res.ok) {
            const json = await res.json().catch(() => null);
            const content = json?.choices?.[0]?.message?.content;
            return typeof content === 'string' ? { ok: true } : { ok: false, status: res.status, detail: 'Provider returned no content.' };
        }
        const text = await res.text().catch(() => '');
        return { ok: false, status: res.status, detail: text.slice(0, 200) };
    } catch (err) {
        return { ok: false, status: 0, detail: err instanceof Error ? err.message : 'Request failed.' };
    } finally {
        clearTimeout(timeout);
    }
}

/** Runs the full diagnostic once and persists the result. Never includes the API key in any
 *  returned value or log — only the model id and provider error text travel back to the caller. */
export async function runDiagnostic(): Promise<AiDiagnosticResult> {
    const apiKey = process.env.NVIDIA_API_KEY;
    const now = new Date().toISOString();
    if (!apiKey) {
        const result: AiDiagnosticResult = { verifiedModel: null, verifiedAt: now, lastError: 'NVIDIA_API_KEY is not set.', modelsTried: [] };
        await setAiDiagnostic(result);
        return result;
    }

    let candidates: string[];
    try {
        candidates = rankCandidates(await fetchCatalog(apiKey));
    } catch (err) {
        const result: AiDiagnosticResult = { verifiedModel: null, verifiedAt: now, lastError: err instanceof Error ? err.message : 'Could not reach the NVIDIA API.', modelsTried: [] };
        await setAiDiagnostic(result);
        return result;
    }

    const tried: string[] = [];
    for (const model of candidates) {
        tried.push(model);
        const outcome = await probe(apiKey, model);
        if (outcome.ok) {
            const result: AiDiagnosticResult = { verifiedModel: model, verifiedAt: now, lastError: null, modelsTried: tried };
            await setAiDiagnostic(result);
            return result;
        }
        // An auth failure means the key itself is bad — trying more models won't help.
        if (outcome.status === 401 || outcome.status === 403) {
            const result: AiDiagnosticResult = { verifiedModel: null, verifiedAt: now, lastError: `Authentication failed (HTTP ${outcome.status}): ${outcome.detail}`, modelsTried: tried };
            await setAiDiagnostic(result);
            return result;
        }
    }

    const result: AiDiagnosticResult = { verifiedModel: null, verifiedAt: now, lastError: `None of ${tried.length} candidate models this account's catalog lists could be invoked. Check your NVIDIA account's enabled models at build.nvidia.com.`, modelsTried: tried };
    await setAiDiagnostic(result);
    return result;
}
