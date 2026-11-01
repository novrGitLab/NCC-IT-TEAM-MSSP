// NCC SOC — shared simulation state. Every engine query/command and route handler reads/writes
// this shape through store.ts. Entity types reuse the real interfaces the retained UI already
// expects (@/lib/vms) so ported domains need no component changes.
import type { VmsAsset, VmsService, VmsTech, VmsEvent, VmsScan } from '@/lib/vms';

export type FindingStatus = 'open' | 'acknowledged' | 'in_progress' | 'fixed_pending_verification' | 'verified' | 'reopened' | 'risk_accepted' | 'false_positive';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export interface FindingRecord {
    id: string; asset_id: string | null; asset_value: string; port: number | null; protocol: string | null;
    source_class: 'active_scan' | 'wazuh'; detected_by: string[]; rule_id: string; title: string; finding_type: string;
    cve_ids: string[]; scanner_severity: Severity; scanner_cvss: number | null; risk_score: number | null;
    priority: Priority | null; status: FindingStatus; owner: string | null; due_at: string | null;
    first_seen: string; last_seen: string; verified_at: string | null; case_id: string | null;
    description?: string | null; remediation?: string | null; references_urls?: string[];
    patch_available: boolean; evidence_class?: string | null;
}

export interface TaskRecord {
    id: string; finding_id: string; title: string; details: string | null; owner: string | null; due_at: string | null;
    status: 'todo' | 'doing' | 'done' | 'cancelled'; ai_artifact_id: string | null; created_by: string; created_at: string; completed_at: string | null;
}

// Matches Sidebar.tsx's NavRole exactly — nav.ts's role-based sidebar visibility is keyed on
// these values, so a role outside this set would leave a signed-in user with an empty sidebar.
export type UserRole = 'super_admin' | 'soc_manager' | 'analyst' | 'executive' | 'portal_user';

export interface UserRecord {
    id: string; email: string; passwordHash: string; role: UserRole; orgId: string | null; name: string; createdAt: string; disabled: boolean;
}

export interface SessionRecord { id: string; userId: string; createdAt: string; expiresAt: string; }

export interface InviteRecord {
    token: string; email: string; role: UserRole; orgId: string | null; invitedBy: string;
    createdAt: string; expiresAt: string; acceptedAt: string | null;
}

export interface OrgRecord { id: string; name: string; domain: string; industry: string; plan: string; wazuh_group?: string; }

export interface AuditEntry { id: string; at: string; actor: string; action: string; details?: Record<string, unknown>; }

export interface AiArtifactRecord {
    id: string;
    purpose: string;
    subjectType: string;
    subjectId: string;
    content: Record<string, unknown>;
    model: string;
    createdAt: string;
    status: 'draft' | 'accepted' | 'rejected';
    feedback: string | null;
    feedbackBy: string | null;
}

/** Everything the simulation persists. Grows as more domains are migrated off src/lib/demo/*. */
export interface SimState {
    version: number;
    clock: { nowIso: string; tickCount: number; speedMultiplier: number };
    scenarioId: string;

    // VMS: assets
    assets: VmsAsset[];
    servicesByAsset: Record<string, VmsService[]>;
    techByAsset: Record<string, VmsTech[]>;
    eventsByAsset: Record<string, VmsEvent[]>;
    events: VmsEvent[];

    // VMS: findings / scans / remediation
    findings: FindingRecord[];
    scans: VmsScan[];
    extraTasks: TaskRecord[];

    // Onboarding
    organisations: OrgRecord[];

    // Auth
    users: UserRecord[];
    sessions: SessionRecord[];
    invites: InviteRecord[];

    // AI analyst output (src/lib/simulation/ai/analyst.ts)
    aiArtifacts: AiArtifactRecord[];

    auditLog: AuditEntry[];
}

export const SIM_STATE_VERSION = 1;
