import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { getFindingsSummary, getRisk, getTasks } from '@ncc-it/backend/simulation/engine';

export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const state = loadState();
        const summary = getFindingsSummary();
        const risk = getRisk();
        const tasks = getTasks();
        const overdueTasks = tasks.filter((t) => t.overdue);
        const activeScans = state.scans.filter((s) => s.status === 'running' || s.status === 'queued');
        const engines = [
            { id: 'discovery', label: 'Discovery', kind: 'discovery', state: 'available' as const, note: '', versions: ['1.8.2'] },
            { id: 'ports', label: 'Ports & services', kind: 'ports', state: 'available' as const, note: '', versions: ['1.8.2'] },
            { id: 'vuln_nuclei', label: 'Nuclei', kind: 'vuln_nuclei', state: 'available' as const, note: '', versions: ['1.8.2'] },
            { id: 'vuln_openvas', label: 'OpenVAS', kind: 'vuln_openvas', state: 'not_enabled' as const, note: 'Disabled in this evaluation environment', versions: [] },
        ];
        const assetsByCriticality: Record<string, number> = {};
        const assetsByExposure: Record<string, number> = {};
        for (const a of state.assets) {
            const c = a.criticality ?? 'unknown';
            assetsByCriticality[c] = (assetsByCriticality[c] ?? 0) + 1;
            assetsByExposure[a.exposure] = (assetsByExposure[a.exposure] ?? 0) + 1;
        }
        const byAssetId = (id: string | null) => state.assets.find((a) => a.id === id) ?? null;

        return NextResponse.json({
            period: { days: Number(req.nextUrl.searchParams.get('days') ?? 30), from: new Date(Date.now() - 30 * 86_400_000).toISOString(), to: new Date().toISOString() },
            kpis: {
                total_assets: state.assets.length, internet_facing_assets: state.assets.filter((a) => a.exposure === 'internet').length,
                open_findings: summary.open, open_vulnerabilities: summary.open, critical_open: summary.by_severity.critical ?? 0,
                critical_exposures: risk.exposure.internet, overdue_tasks: overdueTasks.length, overdue_findings: summary.overdue,
                active_scans: activeScans.length, new_findings: Math.min(2, summary.open), verified_in_period: state.findings.filter((f) => f.status === 'fixed_pending_verification').length,
                remediation_rate: summary.open > 0 ? Math.round((state.findings.length - summary.open) / state.findings.length * 100) / 100 : null,
                risk_mean: risk.trend.at(-1)?.risk_mean ?? null, risk_max: null, engines_available: engines.filter((e) => e.state === 'available').length, engines_total: engines.length,
            },
            definitions: {},
            charts: {
                severity: summary.by_severity, status: summary.by_priority, assets_by_criticality: assetsByCriticality, assets_by_exposure: assetsByExposure,
                new_findings: [], scan_activity: [],
                risk: risk.trend.map((t) => ({ day: t.day, risk_mean: t.risk_mean ?? 0, risk_max: null })),
                exposure: risk.trend.map((t) => ({ day: t.day, critical_exposures: t.critical_exposures, internet_open: t.internet_open, kev_open: t.kev_open })),
                tasks: tasks.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {}),
            },
            lists: {
                recent_critical: state.findings.filter((f) => f.scanner_severity === 'critical').slice(0, 5).map((f) => ({ id: f.id, title: f.title, asset_id: f.asset_id, asset_value: f.asset_value, severity: f.scanner_severity, priority: f.priority, risk_score: f.risk_score, first_seen: f.first_seen, internet: byAssetId(f.asset_id)?.exposure === 'internet' })),
                highest_risk_assets: risk.queue.slice(0, 5).map((q) => ({ asset_id: q.asset_id, value: q.asset_value, open: 1, by_severity: { [q.severity]: 1 }, max_risk: q.risk_score ?? 0, exposure: q.exposure, criticality: q.criticality, asset_type: byAssetId(q.asset_id)?.asset_type ?? null })),
                active_scans: activeScans.map((s) => ({ id: s.id, kind: s.kind, status: s.status, targets: s.targets, progress: s.progress, requested_at: s.requested_at, started_at: s.started_at, heartbeat_at: s.heartbeat_at, worker_id: s.worker_id })),
                overdue_tasks: overdueTasks.slice(0, 5).map((t) => ({ id: t.id, title: t.title, owner: t.owner, due_at: t.due_at ?? '', status: t.status, finding: t.finding })),
                activity: state.events.map((e) => ({ at: e.at, kind: 'asset' as const, event: e.event, subject: e.vms_assets?.value ?? null, subject_id: e.asset_id, details: e.details })),
            },
            engines,
            worker_presence: { state: 'online' as const, online_workers: 1, last_seen_at: new Date().toISOString() },
        });
    } catch (err) {
        return authErrorResponse(err);
    }
}
