import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { loadState } from '@ncc-it/backend/simulation/store';
import { withDiscoveryView } from '@ncc-it/backend/simulation/ncc-discovery';

/** Asset inventory. Applies the page's status, exposure, source and search filters. An
 *  organisation-bound user sees assets with no organisation (shared demo records) and their own. */
export async function GET(req: NextRequest) {
    try {
        const user = await requireSession();
        const p = req.nextUrl.searchParams;
        const status = p.get('status');
        const exposure = p.get('exposure');
        const source = p.get('source');
        const q = (p.get('q') ?? '').trim().toLowerCase();
        const state = loadState();
        const visible = state.assets.filter((a) => !user.orgId || !a.org_id || a.org_id === user.orgId);
        let assets = withDiscoveryView(state, visible);
        if (status === 'active' || status === 'gone') assets = assets.filter((a) => a.status === status);
        if (exposure) assets = assets.filter((a) => a.exposure === exposure);
        if (source === 'simulated_collector') assets = assets.filter((a) => a.simulated);
        if (q) {
            assets = assets.filter((a) => [a.value, ...a.hostnames, ...a.ips, a.ncc?.name ?? '', a.ncc?.type ?? '', ...(a.discovery?.collectors.map((c) => c.name) ?? [])]
                .some((v) => v.toLowerCase().includes(q)));
        }
        return NextResponse.json({ assets, total: assets.length });
    } catch (err) {
        return authErrorResponse(err);
    }
}
