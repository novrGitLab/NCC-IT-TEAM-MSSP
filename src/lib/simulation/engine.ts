// NCC SOC — simulation engine. One query/command function per former src/lib/demo/router.ts
// block, reading/writing through store.ts instead of closing over module-level fixture arrays.
// Same math, same output shapes the retained UI already expects — only the data source changed.
import { randomUUID, randomBytes } from 'node:crypto';
import { loadState, saveState } from './store';
import { hashPassword } from './auth/users';
import type { AiArtifactRecord, AiDiagnosticResult, CollectorInfraCategory, CollectorKind, CollectorRecord, CollectorStatus, FindingRecord, FindingStatus, HandoverLogRecord, IngestionEventRecord, InviteRecord, OrgRecord, PostureEventRecord, PostureEventType, SimState, TaskRecord, UserRecord, UserRole } from './types';
import type { VmsAsset, VmsScan } from '@/lib/vms';

export type PostureLabel = 'secure' | 'monitored' | 'at_risk' | 'critical';

/** Pure: posture label from an already-filtered open-findings list — usable against either the
 *  committed state or an in-flight saveState() draft. */
function postureFromOpenFindings(open: FindingRecord[]): PostureLabel {
    if (open.some((f) => f.scanner_severity === 'critical')) return 'critical';
    if (open.some((f) => f.scanner_severity === 'high')) return 'at_risk';
    if (open.length > 0) return 'monitored';
    return 'secure';
}

/** Current posture label for one asset, derived fresh from its open findings — never stored as a
 *  cached field that could drift from the findings backing it. Reads the committed state; inside
 *  a saveState() mutator, compute the post-mutation value from `draft.findings` directly instead. */
export function computeAssetPosture(assetId: string): PostureLabel {
    return postureFromOpenFindings(loadState().findings.filter((f) => f.asset_id === assetId && !CLOSED.includes(f.status)));
}

function postureOf(findings: FindingRecord[], assetId: string): PostureLabel {
    return postureFromOpenFindings(findings.filter((f) => f.asset_id === assetId && !CLOSED.includes(f.status)));
}

/** Appends a posture event to an in-flight mutation draft — called from inside other saveState()
 *  mutators (patchAsset, patchFinding, the scheduler), never on its own, so one disk write covers
 *  both the underlying change and the posture record it produced. */
export function pushPostureEvent(draft: SimState, assetId: string, assetValue: string, eventType: PostureEventType, previousPosture: string | null, newPosture: string, explanation: string): void {
    const record: PostureEventRecord = { id: randomUUID(), at: new Date().toISOString(), assetId, assetValue, eventType, previousPosture, newPosture, explanation };
    draft.postureEvents.push(record);
}

const CLOSED: FindingStatus[] = ['verified', 'risk_accepted', 'false_positive'];
const isOverdueFinding = (f: FindingRecord, now: number) => !!f.due_at && Date.parse(f.due_at) < now && !CLOSED.includes(f.status);

// --- Assets -----------------------------------------------------------------------------------

export function listAssets(): VmsAsset[] {
    return loadState().assets;
}

export function getAsset(id: string): VmsAsset | null {
    return loadState().assets.find((a) => a.id === id) ?? null;
}

export function getAssetDetail(id: string) {
    const state = loadState();
    const asset = state.assets.find((a) => a.id === id);
    if (!asset) return null;
    return {
        asset,
        services: state.servicesByAsset[asset.id] ?? [],
        technologies: state.techByAsset[asset.id] ?? [],
        events: state.eventsByAsset[asset.id] ?? [],
    };
}

export async function patchAsset(id: string, changes: { owner?: string; criticality?: VmsAsset['criticality'] }): Promise<VmsAsset | null> {
    let updated: VmsAsset | null = null;
    await saveState((draft) => {
        const a = draft.assets.find((x) => x.id === id);
        if (!a) return;
        if (typeof changes.owner === 'string') a.owner = changes.owner;
        if (changes.criticality && changes.criticality !== a.criticality) {
            const posture = postureOf(draft.findings, a.id);
            pushPostureEvent(draft, a.id, a.value, 'criticality_changed', posture, posture, `Business criticality changed from ${a.criticality} to ${changes.criticality}.`);
            a.criticality = changes.criticality;
        }
        updated = a;
    });
    return updated;
}

// --- Findings -----------------------------------------------------------------------------------

export function findingsByStatusGroup(statusParam: string | null): FindingRecord[] {
    const findings = loadState().findings;
    if (!statusParam || statusParam === 'open_all') return findings.filter((f) => !CLOSED.includes(f.status));
    const wanted = new Set(statusParam.split(','));
    if (wanted.has('all')) return findings;
    return findings.filter((f) => wanted.has(f.status));
}

export function getFindingsSummary() {
    const now = Date.now();
    const open = loadState().findings.filter((f) => !CLOSED.includes(f.status));
    const by = (list: FindingRecord[], key: 'scanner_severity' | 'priority') => {
        const out: Record<string, number> = {};
        for (const f of list) { const k = f[key] ?? 'unknown'; out[k] = (out[k] ?? 0) + 1; }
        return out;
    };
    return {
        open: open.length,
        by_severity: by(open, 'scanner_severity'),
        by_priority: by(open, 'priority'),
        known_exploited_open: open.filter((f) => f.cve_ids.length > 0 && f.scanner_severity === 'critical').length,
        overdue: open.filter((f) => isOverdueFinding(f, now)).length,
        by_source: open.reduce<Record<string, number>>((acc, f) => { acc[f.source_class] = (acc[f.source_class] ?? 0) + 1; return acc; }, {}),
    };
}

export function findingDetail(id: string) {
    const state = loadState();
    const finding = state.findings.find((f) => f.id === id);
    if (!finding) return null;
    const daysAgoIso = (iso: string) => iso;
    return {
        finding,
        scanner_cvss: finding.scanner_cvss != null ? { score: finding.scanner_cvss, version: '3.1', vector: null, source: finding.source_class === 'wazuh' ? 'wazuh' : 'nuclei', observed_at: finding.last_seen } : null,
        evidence: [{ id: `ev-${finding.id}`, source: finding.detected_by[0] ?? 'scan', observed_at: finding.last_seen, matched_at: finding.last_seen, evidence: { summary: finding.description ?? finding.title }, job_id: null }],
        events: [
            { id: `evt-${finding.id}-1`, at: finding.first_seen, actor: 'system', action: 'detected', from_value: null, to_value: 'open', details: 'First detected by a scan.' },
            ...(finding.status !== 'open' ? [{ id: `evt-${finding.id}-2`, at: finding.last_seen, actor: finding.owner ?? 'system', action: 'status_changed', from_value: 'open', to_value: finding.status, details: null }] : []),
        ],
        cve_intel: finding.cve_ids.map((cve) => ({
            cve_id: cve, description: `${finding.title} (${cve}).`, cvss_score: finding.scanner_cvss, cvss_vector: null,
            epss_score: finding.scanner_severity === 'critical' ? 0.42 : 0.05, epss_percentile: finding.scanner_severity === 'critical' ? 0.97 : 0.3,
            kev: finding.scanner_severity === 'critical', kev_checked_at: daysAgoIso(finding.last_seen), kev_date_added: finding.scanner_severity === 'critical' ? finding.first_seen : null, kev_required_action: finding.scanner_severity === 'critical' ? 'Apply vendor patch or mitigation.' : null, kev_ransomware: 'Unknown',
        })),
        correlated: [],
        correlation_error: null,
    };
}

export async function patchFinding(id: string, changes: Partial<Pick<FindingRecord, 'status' | 'owner' | 'due_at'>>): Promise<FindingRecord | null> {
    let updated: FindingRecord | null = null;
    await saveState((draft) => {
        const f = draft.findings.find((x) => x.id === id);
        if (!f) return;
        if (changes.status !== undefined && changes.status !== f.status) {
            const assetId = f.asset_id;
            if (assetId) {
                const before = postureOf(draft.findings, assetId);
                f.status = changes.status;
                if (changes.status === 'verified') f.verified_at = new Date().toISOString();
                const after = postureOf(draft.findings, assetId);
                if (changes.status === 'verified') pushPostureEvent(draft, assetId, f.asset_value, 'remediation_completed', before, after, `Finding "${f.title}" marked verified — remediation confirmed.`);
                else if (before !== after) pushPostureEvent(draft, assetId, f.asset_value, 'remediation_completed', before, after, `Finding "${f.title}" status changed to ${changes.status}.`);
            } else {
                f.status = changes.status;
                if (changes.status === 'verified') f.verified_at = new Date().toISOString();
            }
        }
        if (changes.owner !== undefined) f.owner = changes.owner;
        if (changes.due_at !== undefined) f.due_at = changes.due_at;
        f.last_seen = new Date().toISOString();
        updated = f;
    });
    return updated;
}

const TASK_STATUS_TO_FINDING_STATUS: Record<string, FindingStatus> = { todo: 'open', doing: 'in_progress', done: 'fixed_pending_verification', cancelled: 'risk_accepted' };

export async function patchTaskByTaskId(taskId: string, changes: { status?: 'todo' | 'doing' | 'done' | 'cancelled'; owner?: string | null; due_at?: string | null }): Promise<FindingRecord | null> {
    const findingId = taskId.replace(/^task-/, '');
    const mapped = changes.status ? TASK_STATUS_TO_FINDING_STATUS[changes.status] : undefined;
    return patchFinding(findingId, { ...(mapped ? { status: mapped } : {}), ...(changes.owner !== undefined ? { owner: changes.owner } : {}), ...(changes.due_at !== undefined ? { due_at: changes.due_at } : {}) });
}

export async function addExtraTask(findingId: string, body: { title: string; details?: string; owner?: string; due_at?: string; ai_artifact_id?: string | null }): Promise<TaskRecord> {
    let task!: TaskRecord;
    await saveState((draft) => {
        task = { id: `task-ai-${draft.extraTasks.length + 1}`, finding_id: findingId, title: body.title, details: body.details ?? null, owner: body.owner ?? null, due_at: body.due_at ?? null, status: 'todo', ai_artifact_id: body.ai_artifact_id ?? null, created_by: 'AI Analyst', created_at: new Date().toISOString(), completed_at: null };
        draft.extraTasks.push(task);
    });
    return task;
}

export function getRemediationItems() {
    const findings = loadState().findings;
    return findings
        .filter((f) => !CLOSED.includes(f.status) || f.status === 'verified')
        .map((f) => ({ ...f, overdue: isOverdueFinding(f, Date.now()), tasks: f.status !== 'verified' ? [{ id: `task-${f.id}`, title: `Remediate: ${f.title}`, status: f.status === 'open' ? 'todo' : 'doing', owner: f.owner, due_at: f.due_at }] : [] }));
}

export function getTasks() {
    const state = loadState();
    const now = Date.now();
    const fromFindings = state.findings.filter((f) => !CLOSED.includes(f.status)).map((f) => ({
        id: `task-${f.id}`, finding_id: f.id, title: `Remediate: ${f.title}`, details: f.remediation ?? null, owner: f.owner, due_at: f.due_at,
        status: (f.status === 'fixed_pending_verification' ? 'done' : f.status === 'in_progress' || f.status === 'acknowledged' ? 'doing' : 'todo') as 'todo' | 'doing' | 'done' | 'cancelled',
        ai_artifact_id: null, created_by: 'system', created_at: f.first_seen, completed_at: f.status === 'fixed_pending_verification' ? f.last_seen : null, overdue: isOverdueFinding(f, now),
        finding: { id: f.id, title: f.title, asset_value: f.asset_value, scanner_severity: f.scanner_severity, priority: f.priority, status: f.status },
    }));
    const extra = state.extraTasks.map((t) => {
        const f = state.findings.find((x) => x.id === t.finding_id);
        return { ...t, overdue: !!t.due_at && Date.parse(t.due_at) < now, finding: f ? { id: f.id, title: f.title, asset_value: f.asset_value, scanner_severity: f.scanner_severity, priority: f.priority, status: f.status } : null };
    });
    return [...fromFindings, ...extra];
}

export function getRiskScore(): number {
    const open = loadState().findings.filter((f) => !CLOSED.includes(f.status));
    return Math.round(open.reduce((s, f) => s + (f.risk_score ?? 0), 0) / Math.max(open.length, 1));
}

export function getRisk() {
    const state = loadState();
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString().slice(0, 10);
    const assetExposure = (assetId: string | null) => state.assets.find((a) => a.id === assetId)?.exposure ?? 'unknown';
    const assetCriticality = (assetId: string | null) => state.assets.find((a) => a.id === assetId)?.criticality ?? null;

    const open = state.findings.filter((f) => !CLOSED.includes(f.status));
    const by_priority: Record<string, number> = {};
    for (const f of open) { const k = f.priority ?? 'P4'; by_priority[k] = (by_priority[k] ?? 0) + 1; }
    const bands = [['critical', 80], ['high', 60], ['medium', 30], ['low', 0]] as const;
    const score_bands = bands.map(([band, min], i) => ({ band, count: open.filter((f) => (f.risk_score ?? 0) >= min && (f.risk_score ?? 0) < (i === 0 ? 1000 : bands[i - 1][1])).length }));
    const matrix: Record<string, Record<string, number>> = {};
    for (const f of open) {
        const exp = assetExposure(f.asset_id);
        matrix[f.scanner_severity] ??= {};
        matrix[f.scanner_severity][exp] = (matrix[f.scanner_severity][exp] ?? 0) + 1;
    }
    const kevFindings = open.filter((f) => f.cve_ids.length > 0 && f.scanner_severity === 'critical');
    const queue = open.map((f) => ({
        id: f.id, title: f.title, asset_id: f.asset_id, asset_value: f.asset_value, severity: f.scanner_severity, cvss: f.scanner_cvss, priority: f.priority, risk_score: f.risk_score,
        kev: kevFindings.includes(f), epss: f.scanner_severity === 'critical' ? 0.42 : 0.05, exposure: assetExposure(f.asset_id), criticality: assetCriticality(f.asset_id),
        status: f.status, due_at: f.due_at, overdue: isOverdueFinding(f, now), owner: f.owner,
        factors: { technical: { points: Math.round((f.scanner_cvss ?? 0) * 6), basis: 'scanner_cvss' }, exploitation: { points: kevFindings.includes(f) ? 20 : 5, basis: 'kev/epss' }, exposure: { points: assetExposure(f.asset_id) === 'internet' ? 15 : 5, basis: 'exposure' }, criticality: { points: assetCriticality(f.asset_id) === 'critical' ? 15 : 5, basis: 'asset criticality' } },
        evidence_class: f.source_class,
    })).sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
    const trend = Array.from({ length: 14 }, (_, i) => {
        const d = daysAgo(13 - i);
        return { day: d, kev_open: kevFindings.length, internet_open: open.filter((f) => assetExposure(f.asset_id) === 'internet').length, critical_exposures: open.filter((f) => f.scanner_severity === 'critical').length, risk_mean: Math.round(open.reduce((s, f) => s + (f.risk_score ?? 0), 0) / Math.max(open.length, 1)), by_priority };
    });
    return {
        model: {
            weights: { technical: 0.4, exploitation: 0.25, exposure: 0.2, criticality: 0.15 },
            due_days: { P1: 2, P2: 7, P3: 30, P4: 90 },
            thresholds: { critical: '80+', high: '60-79', medium: '30-59', low: '0-29' },
            components: { technical: 'Scanner CVSS', exploitation: 'KEV / EPSS', exposure: 'Internet vs internal', criticality: 'Asset business criticality' },
            evidence_rule: 'A finding needs at least one corroborating scan or Wazuh detection before it counts toward risk.',
            source: 'NCC SOC composite priority model — an internal score, not CVSS/EPSS, with fixed weights in this evaluation build.',
        },
        totals: { open: open.length, with_cve: open.filter((f) => f.cve_ids.length > 0).length, kev: kevFindings.length, overdue: open.filter((f) => isOverdueFinding(f, now)).length },
        by_priority, score_bands, matrix,
        epss: { kev: 0.9, epss_high: 0.08, epss_low: 0.02, unknown: 0.0 },
        exposure: { internet: open.filter((f) => assetExposure(f.asset_id) === 'internet').length, internal: open.filter((f) => assetExposure(f.asset_id) === 'internal').length },
        kev_findings: kevFindings.map((f) => ({ id: f.id, title: f.title, asset_value: f.asset_value, exposure: assetExposure(f.asset_id), priority: f.priority, cve_ids: f.cve_ids, due_at: f.due_at, overdue: isOverdueFinding(f, now) })),
        queue, trend,
    };
}

export function getVmsOverview() {
    const state = loadState();
    return {
        assets: { active: state.assets.filter((a) => a.status === 'active').length, internet_facing: state.assets.filter((a) => a.exposure === 'internet').length, gone: state.assets.filter((a) => a.status === 'gone').length, open_services: 3 },
        last_7_days: { new_assets: 1, changed_assets: 3, gone_assets: 0, new_services: 2 },
        active_scopes: 1,
    };
}

export function getState(): SimState {
    return loadState();
}

export function findingsForAsset(assetId: string): FindingRecord[] {
    return loadState().findings.filter((f) => f.asset_id === assetId);
}

// --- AI artifacts (src/lib/simulation/ai/analyst.ts) --------------------------------------------

export function listArtifacts(subjectType: string, subjectId: string): AiArtifactRecord[] {
    return loadState().aiArtifacts.filter((a) => a.subjectType === subjectType && a.subjectId === subjectId);
}

export async function saveArtifact(input: Omit<AiArtifactRecord, 'id' | 'createdAt' | 'status' | 'feedback' | 'feedbackBy'>): Promise<AiArtifactRecord> {
    const record: AiArtifactRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString(), status: 'draft', feedback: null, feedbackBy: null };
    await saveState((draft) => {
        // One artifact per (purpose, subject) — "Regenerate" replaces the previous draft rather than piling up.
        draft.aiArtifacts = draft.aiArtifacts.filter((a) => !(a.purpose === record.purpose && a.subjectId === record.subjectId));
        draft.aiArtifacts.push(record);
    });
    return record;
}

export async function setArtifactFeedback(id: string, status: 'accepted' | 'rejected', feedback: string | null, feedbackBy: string): Promise<AiArtifactRecord | null> {
    let updated: AiArtifactRecord | null = null;
    await saveState((draft) => {
        const a = draft.aiArtifacts.find((x) => x.id === id);
        if (!a) return;
        a.status = status;
        a.feedback = feedback;
        a.feedbackBy = feedbackBy;
        updated = a;
    });
    return updated;
}

// --- Users / invites (src/lib/simulation/email/invites.ts, src/app/api/invites/**) --------------

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

export function listUsers(): Omit<UserRecord, 'passwordHash'>[] {
    return loadState().users.filter((u) => u.role !== 'portal_user').map(({ passwordHash: _unused, ...rest }) => rest);
}

export async function createInvite(email: string, role: UserRole, invitedBy: string, orgId: string | null = null, jobFunction = '', scope: Record<string, string> = {}): Promise<InviteRecord> {
    const invite: InviteRecord = {
        // 32 random bytes, base64url — 43 characters, matching set-password/page.tsx's token regex.
        token: randomBytes(32).toString('base64url'),
        email: email.trim().toLowerCase(),
        role,
        orgId,
        invitedBy,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        acceptedAt: null,
        jobFunction,
        scope,
    };
    await saveState((draft) => {
        // One live invite per email at a time — a re-invite replaces the previous token.
        draft.invites = draft.invites.filter((i) => i.email !== invite.email || i.acceptedAt);
        draft.invites.push(invite);
    });
    return invite;
}

export function getInvite(token: string): InviteRecord | null {
    return loadState().invites.find((i) => i.token === token) ?? null;
}

export class InviteError extends Error {}

/** Consumes a single-use, non-expired invite and creates the account it was issued for. */
export async function acceptInvite(token: string, password: string, name: string): Promise<UserRecord> {
    const invite = getInvite(token);
    if (!invite) throw new InviteError('Invitation not found.');
    if (invite.acceptedAt) throw new InviteError('This invitation has already been used.');
    if (Date.parse(invite.expiresAt) < Date.now()) throw new InviteError('This invitation has expired.');

    let user!: UserRecord;
    await saveState((draft) => {
        const live = draft.invites.find((i) => i.token === token);
        if (!live || live.acceptedAt) throw new InviteError('This invitation has already been used.');
        user = { id: randomUUID(), email: invite.email, passwordHash: hashPassword(password), role: invite.role, orgId: invite.orgId, name, createdAt: new Date().toISOString(), disabled: false, jobFunction: invite.jobFunction || undefined };
        draft.users.push(user);
        live.acceptedAt = new Date().toISOString();
    });
    return user;
}

// --- Organisations / onboarding (src/app/api/organisations/**) ----------------------------------

export function listOrganisations(): OrgRecord[] {
    return loadState().organisations;
}

export function getOrganisation(id: string): OrgRecord | null {
    return loadState().organisations.find((o) => o.id === id) ?? null;
}

export async function createOrganisation(input: { name: string; domain: string; industry?: string; plan?: string; country?: string; address?: string; contactName?: string; contactEmail?: string; contactPhone?: string; cisoName?: string; cisoEmail?: string; businessUnits?: string[] }): Promise<OrgRecord> {
    const now = new Date().toISOString();
    const org: OrgRecord = {
        id: randomUUID(), name: input.name, domain: input.domain, industry: input.industry ?? '', plan: input.plan ?? 'starter',
        country: input.country, address: input.address, contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone, cisoName: input.cisoName, cisoEmail: input.cisoEmail,
        businessUnits: input.businessUnits ?? [], infrastructureCategories: [], frameworks: [], onboardingStep: 1, onboardingComplete: false,
        createdAt: now, updatedAt: now,
    };
    await saveState((draft) => { draft.organisations.push(org); });
    return org;
}

export async function updateOrganisation(id: string, patch: Partial<Omit<OrgRecord, 'id' | 'createdAt'>>): Promise<OrgRecord | null> {
    let updated: OrgRecord | null = null;
    await saveState((draft) => {
        const o = draft.organisations.find((x) => x.id === id);
        if (!o) return;
        Object.assign(o, patch, { updatedAt: new Date().toISOString() });
        updated = o;
    });
    return updated;
}

// --- Collectors (src/app/api/collectors/**) ------------------------------------------------------

export const COLLECTOR_LIFECYCLE: CollectorStatus[] = ['created', 'configuring', 'connecting', 'validating', 'collecting', 'operational'];

export function listCollectors(orgId?: string): CollectorRecord[] {
    const collectors = loadState().collectors;
    return orgId ? collectors.filter((c) => c.orgId === orgId) : collectors;
}

export function getCollector(id: string): CollectorRecord | null {
    return loadState().collectors.find((c) => c.id === id) ?? null;
}

export async function createCollector(input: { name: string; collectorKind: CollectorKind; infraCategory: CollectorInfraCategory; orgId: string; businessUnit: string; assetScope: string; collectionIntervalMinutes: number }): Promise<CollectorRecord> {
    const now = new Date().toISOString();
    const collector: CollectorRecord = {
        id: randomUUID(), name: input.name, collectorKind: input.collectorKind, infraCategory: input.infraCategory,
        orgId: input.orgId, businessUnit: input.businessUnit, assetScope: input.assetScope, collectionIntervalMinutes: input.collectionIntervalMinutes,
        status: 'created', statusHistory: [{ at: now, status: 'created' }],
        lastHeartbeat: null, lastSync: null, assetsDiscovered: 0, eventsCollected: 0, health: 'healthy', errorMessage: null, createdAt: now,
    };
    await saveState((draft) => { draft.collectors.push(collector); });
    return collector;
}

/** Pause an active collector (scheduler skips paused collectors); resume re-enters the lifecycle
 *  where it left off, or retries from 'connecting' if it stopped on an error. */
export async function pauseCollector(id: string): Promise<CollectorRecord | null> {
    let updated: CollectorRecord | null = null;
    await saveState((draft) => {
        const c = draft.collectors.find((x) => x.id === id);
        if (!c || c.status === 'paused') return;
        c.status = 'paused';
        c.statusHistory.push({ at: new Date().toISOString(), status: 'paused' });
        updated = c;
    });
    return updated;
}

export async function resumeCollector(id: string): Promise<CollectorRecord | null> {
    let updated: CollectorRecord | null = null;
    await saveState((draft) => {
        const c = draft.collectors.find((x) => x.id === id);
        if (!c) return;
        const next: CollectorStatus = c.status === 'error' || c.status === 'paused' ? 'connecting' : c.status;
        c.status = next;
        c.errorMessage = null;
        c.statusHistory.push({ at: new Date().toISOString(), status: next, note: 'Resumed by administrator' });
        updated = c;
    });
    return updated;
}

export async function removeCollector(id: string): Promise<boolean> {
    let removed = false;
    await saveState((draft) => {
        const before = draft.collectors.length;
        draft.collectors = draft.collectors.filter((c) => c.id !== id);
        removed = draft.collectors.length < before;
    });
    return removed;
}

export function listIngestionEvents(collectorId?: string): IngestionEventRecord[] {
    const events = loadState().ingestionEvents;
    return (collectorId ? events.filter((e) => e.collectorId === collectorId) : events).slice(-200).reverse();
}

// --- Posture (src/app/api/posture/**) --------------------------------------------------------

export function listPostureEvents(assetId?: string): PostureEventRecord[] {
    const events = loadState().postureEvents;
    return (assetId ? events.filter((e) => e.assetId === assetId) : events).slice(-500).reverse();
}

export function getPostureSummary() {
    const state = loadState();
    const byLabel: Record<PostureLabel, number> = { secure: 0, monitored: 0, at_risk: 0, critical: 0 };
    for (const a of state.assets) byLabel[computeAssetPosture(a.id)]++;

    const days = 14;
    const dayKey = (iso: string) => iso.slice(0, 10);
    const today = Date.now();
    const trend = Array.from({ length: days }, (_, i) => {
        const day = new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
        const dayEvents = state.postureEvents.filter((e) => dayKey(e.at) === day);
        const byType: Record<string, number> = {};
        for (const e of dayEvents) byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
        return { day, events: dayEvents.length, by_type: byType };
    });

    return { total_assets: state.assets.length, by_posture: byLabel, trend, recent_events: listPostureEvents().slice(0, 20) };
}

// --- Asset-targeted scan (onboarding scenario — src/app/api/vms/assets/[id]/onboarding-scan) ----

const FINDING_TEMPLATES: Record<string, { title: string; finding_type: string; severity: FindingRecord['scanner_severity']; cvss: number; rule_id: string; description: string; remediation: string; patch_available: boolean }> = {
    host: { title: 'Outdated OS packages with known vulnerabilities', finding_type: 'vulnerability', severity: 'high', cvss: 7.4, rule_id: 'outdated-os-packages', description: 'The onboarding scan found multiple OS packages behind current security patch levels.', remediation: 'Patch available — apply the vendor security updates during the next maintenance window.', patch_available: true },
    endpoint: { title: 'Endpoint protection agent reporting stale signatures', finding_type: 'misconfiguration', severity: 'medium', cvss: 5.0, rule_id: 'stale-av-signatures', description: 'The onboarding scan found the endpoint agent has not updated its detection signatures recently.', remediation: 'No vendor patch available yet — force a signature update from the endpoint console.', patch_available: false },
    ip: { title: 'Default management credentials reachable', finding_type: 'exposure', severity: 'critical', cvss: 9.1, rule_id: 'default-mgmt-credentials', description: 'The onboarding scan found a management interface still reachable with vendor-default credentials.', remediation: 'Patch available — rotate the credentials immediately and restrict management-plane access.', patch_available: true },
    domain: { title: 'TLS configuration allows weak cipher suites', finding_type: 'misconfiguration', severity: 'medium', cvss: 5.3, rule_id: 'weak-tls-onboarding', description: 'The onboarding scan found the web service accepts outdated TLS cipher suites.', remediation: 'Patch available — disable TLS 1.0/1.1 and legacy ciphers in the TLS profile.', patch_available: true },
};

export async function startAssetScan(assetId: string): Promise<VmsScan | null> {
    const asset = getAsset(assetId);
    if (!asset) return null;
    const scan: VmsScan = {
        id: `scan-onb-${randomUUID()}`, scope_id: 'onboarding', kind: 'vuln_nuclei', targets: [asset.value], options: {},
        status: 'queued', requested_by: 'Onboarding workflow', requested_at: new Date().toISOString(), started_at: null, finished_at: null,
        progress: {}, error: null, summary: null, worker_id: null, heartbeat_at: null, cancel_requested: false,
        purpose: 'asset_onboarding', target_asset_id: assetId,
    };
    await saveState((draft) => { draft.scans.push(scan); });
    return scan;
}

/** Called by the scheduler once an onboarding scan succeeds — generates exactly one deterministic
 *  finding per asset (never duplicated: a no-op if the asset already has an onboarding finding). */
export function completeOnboardingScan(draft: SimState, scan: VmsScan): void {
    const assetId = scan.target_asset_id;
    if (!assetId) return;
    const asset = draft.assets.find((a) => a.id === assetId);
    if (!asset) return;
    const findingId = `find-onb-${assetId}`;
    if (draft.findings.some((f) => f.id === findingId)) return; // already generated — scans don't duplicate findings
    const template = FINDING_TEMPLATES[asset.asset_type] ?? FINDING_TEMPLATES.host;
    const now = new Date().toISOString();
    const before = postureOf(draft.findings, assetId);
    const finding: FindingRecord = {
        id: findingId, asset_id: assetId, asset_value: asset.value, port: null, protocol: null,
        source_class: 'active_scan', detected_by: ['vuln_nuclei'], rule_id: template.rule_id, title: template.title, finding_type: template.finding_type,
        cve_ids: [], scanner_severity: template.severity, scanner_cvss: template.cvss, risk_score: Math.round(template.cvss * 10),
        priority: template.severity === 'critical' ? 'P1' : template.severity === 'high' ? 'P2' : 'P3', status: 'open', owner: null, due_at: null,
        first_seen: now, last_seen: now, verified_at: null, case_id: null, description: template.description, remediation: template.remediation, patch_available: template.patch_available,
    };
    draft.findings.push(finding);
    const after = postureOf(draft.findings, assetId);
    pushPostureEvent(draft, assetId, asset.value, 'vulnerability_identified', before, after, `Onboarding scan found "${finding.title}" (${finding.scanner_severity}).`);
}

// --- AI model diagnostic (src/lib/simulation/ai/diagnostic.ts) -----------------------------------

export function getAiDiagnostic(): AiDiagnosticResult {
    return loadState().aiDiagnostic;
}

export async function setAiDiagnostic(result: AiDiagnosticResult): Promise<void> {
    await saveState((draft) => { draft.aiDiagnostic = result; });
}

// --- Shift handover (src/app/api/secops/handover, src/components/features/ShiftHandover.tsx) ----

export function listHandoverLogs(): HandoverLogRecord[] {
    return [...loadState().handoverLogs].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function getLatestHandoverLog(): HandoverLogRecord | null {
    return listHandoverLogs()[0] ?? null;
}

export async function createHandoverLog(input: Omit<HandoverLogRecord, 'id' | 'submittedAt'>): Promise<HandoverLogRecord> {
    const log: HandoverLogRecord = { ...input, id: `handover-${randomUUID()}`, submittedAt: new Date().toISOString() };
    await saveState((draft) => { draft.handoverLogs.push(log); });
    return log;
}
