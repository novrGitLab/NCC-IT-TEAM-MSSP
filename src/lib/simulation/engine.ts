// NCC SOC — simulation engine. One query/command function per former src/lib/demo/router.ts
// block, reading/writing through store.ts instead of closing over module-level fixture arrays.
// Same math, same output shapes the retained UI already expects — only the data source changed.
import { randomUUID, randomBytes } from 'node:crypto';
import { loadState, saveState } from './store';
import { hashPassword } from './auth/users';
import type { AiArtifactRecord, FindingRecord, FindingStatus, InviteRecord, SimState, TaskRecord, UserRecord, UserRole } from './types';
import type { VmsAsset } from '@/lib/vms';

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
        if (changes.criticality) a.criticality = changes.criticality;
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
        if (changes.status !== undefined) { f.status = changes.status; if (changes.status === 'verified') f.verified_at = new Date().toISOString(); }
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

export async function createInvite(email: string, role: UserRole, invitedBy: string): Promise<InviteRecord> {
    const invite: InviteRecord = {
        // 32 random bytes, base64url — 43 characters, matching set-password/page.tsx's token regex.
        token: randomBytes(32).toString('base64url'),
        email: email.trim().toLowerCase(),
        role,
        orgId: null,
        invitedBy,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        acceptedAt: null,
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
        user = { id: randomUUID(), email: invite.email, passwordHash: hashPassword(password), role: invite.role, orgId: invite.orgId, name, createdAt: new Date().toISOString(), disabled: false };
        draft.users.push(user);
        live.acceptedAt = new Date().toISOString();
    });
    return user;
}
