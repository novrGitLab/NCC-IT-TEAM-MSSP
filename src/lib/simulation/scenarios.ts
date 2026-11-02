// NCC SOC — builds the initial SimState. Deterministic given the same inputs: no separate seed
// snapshot file to keep in sync with the generators, a fresh checkout always starts from the same
// baseline. The first admin user is created from server-only SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
// (never NEXT_PUBLIC_*) — if unset, falls back to a documented evaluation default.
import { randomBytes, randomUUID } from 'node:crypto';
import { buildSeedAssets, buildSeedEventsByAsset, buildSeedEvents, buildSeedServicesByAsset, buildSeedTechByAsset } from './generators/assets';
import { buildSeedFindings, buildSeedScans } from './generators/findings';
import { hashPassword } from './auth/users';
import type { SimState, UserRecord, UserRole } from './types';
import { SIM_STATE_VERSION } from './types';

// Representative fictional staff for the team roster and the shift-handover picker. Each account
// gets a random password hash that nobody is ever shown, so these accounts cannot sign in; they
// exist only to populate the roster and the handover workflow.
const REPRESENTATIVE_STAFF: { name: string; email: string; role: UserRole; jobFunction: string }[] = [
    { name: 'Daniel Mercer', email: 'daniel.mercer@ncc-soc.demo', role: 'analyst', jobFunction: 'soc_analyst' },
    { name: 'Priya Raman', email: 'priya.raman@ncc-soc.demo', role: 'analyst', jobFunction: 'soc_analyst' },
    { name: 'Lucas Brandt', email: 'lucas.brandt@ncc-soc.demo', role: 'analyst', jobFunction: 'vuln_analyst' },
    { name: 'Sofia Alvarez', email: 'sofia.alvarez@ncc-soc.demo', role: 'analyst', jobFunction: 'vuln_analyst' },
    { name: 'Marcus Hale', email: 'marcus.hale@ncc-soc.demo', role: 'soc_manager', jobFunction: 'security_manager' },
];

function unissuedPasswordHash(): string {
    return hashPassword(randomBytes(32).toString('base64url'));
}

/** Adds any representative staff account whose email is not already present. Existing users and
 *  invitation records are left untouched. Returns true when something was added. */
export function ensureRepresentativeStaff(state: Pick<SimState, 'users'>, createdAt = new Date().toISOString()): boolean {
    let added = false;
    for (const person of REPRESENTATIVE_STAFF) {
        if (state.users.some((u) => u.email === person.email)) continue;
        const user: UserRecord = {
            id: randomUUID(), email: person.email, passwordHash: unissuedPasswordHash(), role: person.role, orgId: null,
            name: person.name, createdAt, disabled: false, jobFunction: person.jobFunction,
        };
        state.users.push(user);
        added = true;
    }
    return added;
}

function withRepresentativeStaff(users: UserRecord[], createdAt: string): UserRecord[] {
    ensureRepresentativeStaff({ users }, createdAt);
    return users;
}

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
            {
                id: 'org-demo-1', name: 'NCC SOC Evaluation Org', domain: 'ncc-soc.demo', industry: 'Telecommunications', plan: 'Evaluation',
                businessUnits: ['Platform', 'Finance', 'Engineering'], infrastructureCategories: ['servers', 'middleware', 'cloud'],
                frameworks: [{ framework: 'NDPA', enabled: true, initialScore: 0 }],
                onboardingStep: 5, onboardingComplete: true,
                createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
            },
        ],
        collectors: [],
        ingestionEvents: [],
        postureEvents: [],

        users: withRepresentativeStaff([
            { id: randomUUID(), email: adminEmail.toLowerCase(), passwordHash: hashPassword(adminPassword), role: 'super_admin', orgId: null, name: 'Administrator', createdAt: new Date(now).toISOString(), disabled: false },
            { id: randomUUID(), email: 'client@ncc-soc.demo', passwordHash: hashPassword('change-me-now'), role: 'portal_user', orgId: 'org-demo-1', name: 'Client Contact', createdAt: new Date(now).toISOString(), disabled: false },
        ], new Date(now).toISOString()),
        sessions: [],
        invites: [],
        aiArtifacts: [],
        aiDiagnostic: { verifiedModel: null, verifiedAt: null, lastError: null, modelsTried: [] },

        auditLog: [],

        handoverLogs: [],
    };
}
