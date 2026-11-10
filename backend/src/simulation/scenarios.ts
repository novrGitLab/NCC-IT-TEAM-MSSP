// NCC IT — builds the initial SimState. Deterministic given the same inputs: no separate seed
// snapshot file to keep in sync with the generators, a fresh checkout always starts from the same
// baseline. The first admin user is created from server-only SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
// (never NEXT_PUBLIC_*) — if unset, falls back to a documented evaluation default.
import { randomBytes, randomUUID } from 'node:crypto';
import { buildSeedAssets, buildSeedEventsByAsset, buildSeedEvents, buildSeedServicesByAsset, buildSeedTechByAsset } from './generators/assets';
import { buildSeedFindings, buildSeedScans } from './generators/findings';
import { hashPassword, verifyPassword } from './auth/users';
import { buildSocSeed } from './generators/soc';
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

/** SOC alerts, cases and approvals, seeded from the assets. Clock-relative, so it is the same for
 *  a given clock value. */
export function socSeedFields(nowIso: string, assets: { id: string; value: string }[]) {
    const seed = buildSocSeed(Date.parse(nowIso), (assetId) => assets.find((a) => a.id === assetId)?.value ?? assetId);
    return { socAlerts: seed.alerts, socCases: seed.cases, socApprovals: seed.approvals };
}

/** Keeps the administrator account in line with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. There is no
 *  default password. The account is created when it is missing. For an existing account the configured
 *  password is applied only when ADMIN_PASSWORD_RESET=true (that account's sessions then end). Otherwise
 *  a mismatch is reported without printing either password and the stored password is kept. Nothing else
 *  in the state changes. */
export function ensureAdministrator(state: Pick<SimState, 'users' | 'sessions'>): boolean {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) return false;
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@ncc-it.local').trim().toLowerCase();
    const existing = state.users.find((u) => u.email === email && u.role !== 'portal_user');
    if (!existing) {
        state.users.push({
            id: randomUUID(), email, passwordHash: hashPassword(password), role: 'super_admin', orgId: null,
            name: 'Administrator', createdAt: new Date().toISOString(), disabled: false,
        });
        return true;
    }
    if (existing.role !== 'super_admin') return false;
    if (process.env.ADMIN_PASSWORD_RESET === 'true') {
        existing.passwordHash = hashPassword(password);
        existing.disabled = false;
        state.sessions = state.sessions.filter((session) => session.userId !== existing.id);
        return true;
    }
    if (!verifyPassword(password, existing.passwordHash)) {
        console.warn(`[auth] SEED_ADMIN_PASSWORD does not match the stored password for ${email}; the stored password is kept. Set ADMIN_PASSWORD_RESET=true for one start to apply the configured password, then remove it.`);
    }
    return false;
}

/** Adds the SOC dataset to state written before it existed. Records already present are kept. */
export function ensureSocSeed(state: SimState): boolean {
    if (Array.isArray(state.socAlerts) && Array.isArray(state.socCases) && Array.isArray(state.socApprovals)) return false;
    Object.assign(state, socSeedFields(state.clock.nowIso, state.assets));
    return true;
}

function withRepresentativeStaff(users: UserRecord[], createdAt: string): UserRecord[] {
    ensureRepresentativeStaff({ users }, createdAt);
    return users;
}

export function buildDefaultState(): SimState {
    const now = Date.now();
    const assets = buildSeedAssets(now);
    const valueOf = (assetId: string) => assets.find((a) => a.id === assetId)?.value ?? assetId;

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ncc-it.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || '';

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
                id: 'org-demo-1', name: 'NCC IT Evaluation Org', domain: 'ncc-soc.demo', industry: 'Telecommunications', plan: 'Evaluation',
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
            ...(adminPassword ? [{ id: randomUUID(), email: adminEmail.toLowerCase(), passwordHash: hashPassword(adminPassword), role: 'super_admin' as const, orgId: null, name: 'Administrator', createdAt: new Date(now).toISOString(), disabled: false }] : []),
            { id: randomUUID(), email: 'client@ncc-soc.demo', passwordHash: unissuedPasswordHash(), role: 'portal_user', orgId: 'org-demo-1', name: 'Client Contact', createdAt: new Date(now).toISOString(), disabled: false },
        ], new Date(now).toISOString()),
        sessions: [],
        invites: [],
        aiArtifacts: [],
        aiDiagnostic: { verifiedModel: null, verifiedAt: null, lastError: null, modelsTried: [] },

        auditLog: [],

        handoverLogs: [],
        collectorMappings: [],
        ...socSeedFields(new Date(now).toISOString(), assets),
    };
}
