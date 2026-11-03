import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { DEMO_WORKER_STATUS } from '@/lib/demo/collectors';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({
            deployed_version: '1.8.2',
            workers: { source: 'simulation', online: DEMO_WORKER_STATUS.workers.filter((w) => w.status === 'online').length, window_seconds: 300, list: DEMO_WORKER_STATUS.workers.map((w) => ({ worker_id: w.id, online: w.status === 'online', version: '1.8.2', kinds: w.kind.split(','), tools: { nmap: true, nuclei: true, subfinder: true }, tool_versions: {}, networks: [], features: [], last_seen_at: w.last_seen, last_heartbeat_at: w.last_seen, last_claim_at: null, last_job_at: null })) },
            scheduler: { last_run_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), policies: { at: new Date(Date.now() - 24 * 3_600_000).toISOString() } },
            wazuh: { available: true, freshness: { last_attempt_at: new Date(Date.now() - 3_600_000).toISOString(), last_complete_at: new Date(Date.now() - 3_600_000).toISOString(), complete: true, problem: null } },
            cve_intel: { tracked: loadState().findings.length, kev_checked_at: new Date(Date.now() - 6 * 3_600_000).toISOString(), epss_fetched_at: new Date(Date.now() - 6 * 3_600_000).toISOString(), nvd_fetched_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), osv: { available: true, fetched_at: new Date(Date.now() - 6 * 3_600_000).toISOString() } },
            ai: { configured: !!process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL || 'none (not configured)' },
            evidence: { available: true, retention_days: 30, items: 0, next_expiry: null },
            scopes: { active: 1, expired_or_revoked: 0, with_exclusions: 0, passive_only: 0, vuln_allowed: 1 },
            policies: { available: true, note: 'Evaluation policy — not editable in this environment.', list: [] },
        });
    } catch (err) {
        return authErrorResponse(err);
    }
}
