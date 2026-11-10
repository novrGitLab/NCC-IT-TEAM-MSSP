// NCC IT — shared simulation state. Every engine query/command and route handler reads/writes
// this shape through store.ts. Entity types reuse the real interfaces the retained UI already
// expects (@/lib/vms) so ported domains need no component changes.
import type { VmsAsset, VmsService, VmsTech, VmsEvent, VmsScan } from '../contracts/vms';

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
    /** Job function from the invitation or seed (src/lib/team/invite-functions.ts). Descriptive only. */
    jobFunction?: string;
}

export interface SessionRecord { id: string; userId: string; createdAt: string; expiresAt: string; }

export interface InviteRecord {
    token: string; email: string; role: UserRole; orgId: string | null; invitedBy: string;
    createdAt: string; expiresAt: string; acceptedAt: string | null;
    /** Job function the invite was issued for (src/lib/team/invite-functions.ts). Recorded only. */
    jobFunction: string;
    scope: Record<string, string>;
}

export interface OrgFramework { framework: string; enabled: boolean; initialScore: number }

export interface OrgRecord {
    id: string; name: string; domain: string; industry: string; plan: string; wazuh_group?: string;
    businessUnits: string[]; infrastructureCategories: string[];
    country?: string; address?: string;
    contactName?: string; contactEmail?: string; contactPhone?: string; cisoName?: string; cisoEmail?: string;
    frameworks: OrgFramework[];
    onboardingStep: number; onboardingComplete: boolean;
    createdAt: string; updatedAt: string;
}

export type CollectorKind = 'endpoint' | 'network_telemetry' | 'api_connector' | 'log_forwarding' | 'agentless' | 'vuln_assessment';
export type CollectorInfraCategory = 'servers' | 'middleware' | 'cloud' | 'endpoints' | 'dev_workstations' | 'network' | 'firewall';
export type CollectorStatus = 'created' | 'configuring' | 'connecting' | 'validating' | 'collecting' | 'operational' | 'paused' | 'error';

export interface CollectorStatusEvent { at: string; status: CollectorStatus; note?: string }

export interface CollectorRecord {
    id: string; name: string;
    collectorKind: CollectorKind; infraCategory: CollectorInfraCategory;
    orgId: string; businessUnit: string; assetScope: string;
    collectionIntervalMinutes: number;
    status: CollectorStatus; statusHistory: CollectorStatusEvent[];
    lastHeartbeat: string | null; lastSync: string | null;
    assetsDiscovered: number; eventsCollected: number;
    health: 'healthy' | 'degraded' | 'down';
    errorMessage: string | null;
    createdAt: string;
}

export interface IngestionEventRecord {
    id: string; collectorId: string; at: string;
    assetCategory: string; eventType: string;
    processingState: 'received' | 'normalized' | 'applied';
    normalizedFields: Record<string, unknown>;
    assetId: string | null;
}

export type PostureEventType = 'asset_discovered' | 'vulnerability_identified' | 'criticality_changed' | 'threat_correlated' | 'remediation_completed' | 'patch_verified';

export interface PostureEventRecord {
    id: string; at: string; assetId: string; assetValue: string;
    eventType: PostureEventType; previousPosture: string | null; newPosture: string; explanation: string;
}

export interface AiDiagnosticResult {
    verifiedModel: string | null;
    verifiedAt: string | null;
    lastError: string | null;
    modelsTried: string[];
}

export interface AuditEntry { id: string; at: string; actor: string; action: string; details?: Record<string, unknown>; }

export interface HandoverLogRecord {
    id: string;
    shiftStart: string;
    shiftEnd: string;
    analystOff: string;
    analystOn: string;
    casesReceived: number;
    casesResolved: number;
    casesPending: number;
    criticalCases: string[];
    ongoingCases: string[];
    watchPriority: 'Low' | 'Medium' | 'High';
    watchItems: string;
    notes: string;
    submittedBy: string;
    submittedAt: string;
}

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
    collectors: CollectorRecord[];
    ingestionEvents: IngestionEventRecord[];
    postureEvents: PostureEventRecord[];

    // Auth
    users: UserRecord[];
    sessions: SessionRecord[];
    invites: InviteRecord[];

    // AI analyst output (src/lib/simulation/ai/analyst.ts)
    aiArtifacts: AiArtifactRecord[];
    aiDiagnostic: AiDiagnosticResult;

    auditLog: AuditEntry[];

    // SecOps management (src/app/api/secops/handover, src/components/features/ShiftHandover.tsx)
    handoverLogs: HandoverLogRecord[];

    // Collector-to-NCC-infrastructure mappings (src/simulation/collector-mapping.ts)
    collectorMappings: CollectorInfraMappingRecord[];

    // SOC alerts, cases and approvals (src/lib/simulation/soc-runtime.ts, soc-store.ts)
    socAlerts: SocAlertRecord[];
    socCases: SocCaseRecord[];
    socApprovals: SocApprovalRecord[];
}

export interface CollectorInfraMappingRecord {
    id: string;
    orgId: string;
    collectorId: string;
    /** Stable id from backend/src/contracts/ncc-infrastructure.ts. */
    infrastructureId: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
}

export type SocSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SocLifecycle = 'new' | 'monitoring' | 'triaged' | 'pending_approval' | 'escalated' | 'case_created' | 'auto_closed' | 'manually_closed' | 'false_positive';
export type SocDetectionSource = 'endpoint_agent' | 'firewall' | 'network_sensor' | 'app_telemetry' | 'cloud_audit' | 'api_gateway' | 'identity_provider' | 'vulnerability_scan';
export type SocCaseStatus = 'open' | 'investigating' | 'contained' | 'resolved';
export type SocApprovalStatus = 'pending' | 'approved' | 'rejected' | 'info_requested';

export interface PolicyHistoryEntry {
    at: string;
    action: string;
    reason: string;
    policy_version: string;
    evidence: { event_count: number; longest_continuous_ms: number; quiet_ms: number; window_ends_at: string | null; highest_severity: SocSeverity };
}

export interface SocAlertRecord {
    id: string;
    title: string;
    severity: SocSeverity;
    category: string;
    detection_source: SocDetectionSource;
    asset_id: string;
    asset_value: string;
    identity: string | null;
    rule_id: string;
    mitre_ids: string[];
    correlation_key: string;
    lifecycle: SocLifecycle;
    evidence_summary: string;
    related_events: { at: string; text: string }[];
    detected_at: string;
    assigned_to: string | null;
    case_id: string | null;
    policy_history: PolicyHistoryEntry[];
}

export interface SocTimelineEntry { at: string; text: string }
export interface SocCaseNote { id: string; at: string; author: string; text: string }

export interface SocCaseRecord {
    id: string;
    title: string;
    severity: SocSeverity;
    status: SocCaseStatus;
    tier: number;
    correlation_key: string | null;
    asset_ids: string[];
    alert_ids: string[];
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    timeline: SocTimelineEntry[];
    notes: SocCaseNote[];
    recommended_actions: { id: string; action: string; target: string; requires_approval: boolean; simulated: true }[];
    approval_ids: string[];
    auto_closed: boolean;
    escalated: boolean;
    mitre: { id: string; tactic: string }[];
}

export interface SocApprovalHistoryEntry { at: string; actor: string; action: 'requested' | 'approved' | 'rejected' | 'info_requested'; reason: string | null }

export interface SocApprovalRecord {
    id: string;
    case_id: string;
    alert_id: string | null;
    asset_id: string | null;
    action: string;
    target: string;
    severity: SocSeverity;
    status: SocApprovalStatus;
    requested_at: string;
    requested_by: string;
    approver: string | null;
    explanation: string;
    evidence: string[];
    risk_impact: string;
    sla_due_at: string;
    decided_at: string | null;
    decided_by: string | null;
    decision_reason: string | null;
    history: SocApprovalHistoryEntry[];
}

export const SIM_STATE_VERSION = 2;
