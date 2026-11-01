// NCC SOC — builds the initial SimState. Deterministic given the same inputs: no separate seed
// snapshot file to keep in sync with the generators, a fresh checkout always starts from the same
// baseline. The first admin user is created from server-only SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
// (never NEXT_PUBLIC_*) — if unset, falls back to a documented evaluation default.
import { randomUUID } from 'node:crypto';
import { buildSeedAssets, buildSeedEventsByAsset, buildSeedEvents, buildSeedServicesByAsset, buildSeedTechByAsset } from './generators/assets';
import { buildSeedFindings, buildSeedScans } from './generators/findings';
import { hashPassword } from './auth/users';
import type { SimState } from './types';
import { SIM_STATE_VERSION } from './types';

export function buildDefaultState(): SimState {
    const now = Date.now();
    const assets = buildSeedAssets(now);
    const valueOf = (assetId: string) => assets.find((a) => a.id === assetId)?.value ?? assetId;

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ncc-soc.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'change-me-now';

    return {
        version: SIM_STATE_VERSION,
        clock: { nowIso: new Date(now).toISOString(), tickCount: 0, speedMultiplier: 1 },
        scenarioId: 'default',

        assets,
        servicesByAsset: buildSeedServicesByAsset(now),
        techByAsset: buildSeedTechByAsset(now),
        eventsByAsset: buildSeedEventsByAsset(now, assets),
        events: buildSeedEvents(now, assets),

        findings: buildSeedFindings(now, valueOf),
        scans: buildSeedScans(now),
        extraTasks: [],

        organisations: [
            { id: 'org-demo-1', name: 'NCC SOC Evaluation Org', domain: 'ncc-soc.demo', industry: 'Telecommunications', plan: 'Evaluation' },
        ],

        users: [
            { id: randomUUID(), email: adminEmail.toLowerCase(), passwordHash: hashPassword(adminPassword), role: 'super_admin', orgId: null, name: 'Administrator', createdAt: new Date(now).toISOString(), disabled: false },
            { id: randomUUID(), email: 'client@ncc-soc.demo', passwordHash: hashPassword('change-me-now'), role: 'portal_user', orgId: 'org-demo-1', name: 'Client Contact', createdAt: new Date(now).toISOString(), disabled: false },
        ],
        sessions: [],
        invites: [],
        aiArtifacts: [],

        auditLog: [],
    };
}
