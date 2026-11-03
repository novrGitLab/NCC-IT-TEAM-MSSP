import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { listCollectors } from '@ncc-it/backend/simulation/engine';

// Backward-compat shape for OnboardingWizard.tsx's CollectorWalkthrough, which matches collectors
// by `asset_type` and reads `integration`/`last_heartbeat`/`telemetry_events_24h`. Reshapes the
// real, persisted CollectorRecord[] into that legacy field layout rather than changing the
// component — so real collectors created via POST /api/collectors show up there automatically.
const CATEGORY_TO_ASSET_TYPE: Record<string, string> = {
    servers: 'server', middleware: 'middleware', cloud: 'cloud', endpoints: 'workstation', dev_workstations: 'workstation', network: 'network', firewall: 'network',
};

export async function GET() {
    try {
        await requireSession();
        const collectors = listCollectors().map((c) => ({
            id: c.id, name: c.name, asset_type: CATEGORY_TO_ASSET_TYPE[c.infraCategory] ?? c.infraCategory,
            integration: `${c.collectorKind.replace(/_/g, ' ')} (${c.infraCategory})`,
            status: c.status === 'operational' ? 'connected' : c.status === 'error' || c.status === 'paused' ? 'disconnected' : 'connecting',
            last_heartbeat: c.lastHeartbeat ?? c.createdAt, telemetry_events_24h: c.eventsCollected,
        }));
        return NextResponse.json({ collectors });
    } catch (err) {
        return authErrorResponse(err);
    }
}
