import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { DEMO_TI_FEEDS } from '@/lib/demo/threats';

export async function GET() {
    try {
        await requireSession();
        const configured = !!process.env.NVIDIA_API_KEY;
        return NextResponse.json({
            feeds: DEMO_TI_FEEDS,
            runs: [],
            enrichment: { nvd: { last_fetch: new Date(Date.now() - 2 * 3_600_000).toISOString(), configured_key: true, cves_tracked: loadState().findings.length }, epss: { last_fetch: new Date(Date.now() - 6 * 3_600_000).toISOString() } },
            misp: { configured: true, writes_enabled: false, last_check: null },
            ai: { provider: 'nvidia', configured, model: process.env.NVIDIA_MODEL || 'none (not configured)', reachable: false, detail: configured ? 'Configured — invoked on demand from the AI Intelligence Analyst page.' : 'AI is not configured in this environment.' },
            sharing: { source_records_by_tlp: { clear: 2, green: 1, amber: 0, 'amber+strict': 0, red: 0 } },
            exchange: { taxii_discovery: '', api_root: '', collections: [], active_clients: 0 },
        });
    } catch (err) {
        return authErrorResponse(err);
    }
}
