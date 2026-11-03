// Illustrative SOC dataset: alerts, cases and approval requests over the seeded fictional assets.
// Every record is deterministic (offsets from a supplied clock value) and references asset IDs
// from the seed inventory. These are illustrative scenarios, not observed incidents.
import type { SocAlertRecord, SocApprovalRecord, SocCaseRecord, PolicyHistoryEntry, SocSeverity, SocLifecycle, SocDetectionSource } from '../types';

const MIN = 60_000;
const POLICY_VERSION = '2026-11-v1';

interface AlertSpec {
    id: string; minutesAgo: number; severity: SocSeverity; category: string; source: SocDetectionSource; assetId: string; identity: string | null;
    ruleId: string; title: string; mitre: string[]; lifecycle: SocLifecycle; caseId: string | null; assignee: string | null; evidence: string;
    history: { minutesAgo: number; action: string; reason: string }[];
}

const ALERTS: AlertSpec[] = [
    // Repeated failed authentication against web-edge-01 (escalated to case-5001: 5 related alerts within one hour).
    { id: 'alert-9001', minutesAgo: 50, severity: 'high', category: 'Repeated failed authentication', source: 'endpoint_agent', assetId: 'asset-001', identity: 'root', ruleId: 'sshd-auth-failure', title: 'Multiple SSH authentication failures', mitre: ['T1110'], lifecycle: 'case_created', caseId: 'case-5001', assignee: 'Daniel Mercer', evidence: 'Five failed root logins from one source within 50 minutes on the SSH service.', history: [{ minutesAgo: 40, action: 'escalate_case', reason: '5 related high alerts within one hour: escalated to a security case.' }] },
    { id: 'alert-9008', minutesAgo: 45, severity: 'high', category: 'Repeated failed authentication', source: 'endpoint_agent', assetId: 'asset-001', identity: 'root', ruleId: 'sshd-auth-failure', title: 'SSH authentication failure', mitre: ['T1110'], lifecycle: 'case_created', caseId: 'case-5001', assignee: 'Daniel Mercer', evidence: 'Repeated root login failure from the same source.', history: [{ minutesAgo: 40, action: 'escalate_case', reason: '5 related high alerts within one hour: escalated to a security case.' }] },
    { id: 'alert-9014', minutesAgo: 40, severity: 'high', category: 'Repeated failed authentication', source: 'endpoint_agent', assetId: 'asset-001', identity: 'root', ruleId: 'sshd-auth-failure', title: 'SSH authentication failure', mitre: ['T1110'], lifecycle: 'case_created', caseId: 'case-5001', assignee: 'Daniel Mercer', evidence: 'Repeated root login failure from the same source.', history: [{ minutesAgo: 40, action: 'escalate_case', reason: '5 related high alerts within one hour: escalated to a security case.' }] },
    { id: 'alert-9015', minutesAgo: 30, severity: 'high', category: 'Repeated failed authentication', source: 'endpoint_agent', assetId: 'asset-001', identity: 'root', ruleId: 'sshd-auth-failure', title: 'SSH authentication failure', mitre: ['T1110'], lifecycle: 'case_created', caseId: 'case-5001', assignee: 'Daniel Mercer', evidence: 'Repeated root login failure from the same source.', history: [{ minutesAgo: 30, action: 'escalate_case', reason: '5 related high alerts within one hour: escalated to a security case.' }] },
    { id: 'alert-9016', minutesAgo: 12, severity: 'high', category: 'Repeated failed authentication', source: 'endpoint_agent', assetId: 'asset-001', identity: 'root', ruleId: 'sshd-auth-failure', title: 'SSH authentication failure', mitre: ['T1110'], lifecycle: 'case_created', caseId: 'case-5001', assignee: 'Daniel Mercer', evidence: 'Repeated root login failure from the same source.', history: [{ minutesAgo: 12, action: 'escalate_case', reason: '5 related high alerts within one hour: escalated to a security case.' }] },
    // Critical: WebLogic deserialization payload (case-5002, approval appr-1 already approved by a human).
    { id: 'alert-9002', minutesAgo: 40, severity: 'critical', category: 'Exploit attempt on exposed application', source: 'app_telemetry', assetId: 'asset-003', identity: null, ruleId: 'weblogic-deser-payload', title: 'Suspicious WebLogic deserialization payload', mitre: ['T1190', 'T1059'], lifecycle: 'case_created', caseId: 'case-5002', assignee: 'Priya Raman', evidence: 'Serialized Java object posted to the console port matched a known deserialization gadget chain.', history: [{ minutesAgo: 40, action: 'create_case', reason: 'Critical alert: a security case is created immediately and must be assigned to an analyst.' }] },
    // Medium: SQL injection attempt, triaged by an analyst (human-owned: not re-decided by policy).
    { id: 'alert-9003', minutesAgo: 90, severity: 'medium', category: 'Web attack', source: 'network_sensor', assetId: 'asset-001', identity: null, ruleId: 'web-sqli-attempt', title: 'Web attack: SQL injection attempt', mitre: ['T1190'], lifecycle: 'triaged', caseId: null, assignee: 'Daniel Mercer', evidence: 'Single request with a SQL tautology in a query parameter; response returned HTTP 400.', history: [{ minutesAgo: 90, action: 'monitor', reason: 'New or recently active alert group under monitoring.' }] },
    // Low: sudo to root on a developer sandbox, quiet for over 30 minutes, closed automatically.
    { id: 'alert-9004', minutesAgo: 140, severity: 'low', category: 'Privilege use', source: 'endpoint_agent', assetId: 'asset-013', identity: 'dev-user', ruleId: 'sudo-root', title: 'Successful sudo to root', mitre: ['T1548'], lifecycle: 'auto_closed', caseId: null, assignee: null, evidence: 'One sudo session on a developer sandbox, consistent with routine work.', history: [{ minutesAgo: 110, action: 'auto_close', reason: 'No related alert for 30 minutes: the group is closed automatically.' }] },
    // Critical: outbound connection to a known malicious address (case-5003, approval appr-2 pending).
    { id: 'alert-9005', minutesAgo: 5, severity: 'critical', category: 'Command and control', source: 'cloud_audit', assetId: 'asset-023', identity: null, ruleId: 'threatfox-ioc-match', title: 'Outbound connection to known malicious IP', mitre: ['T1071', 'T1041'], lifecycle: 'case_created', caseId: 'case-5003', assignee: 'Daniel Mercer', evidence: 'Egress flow to an address on a current threat-intelligence indicator list.', history: [{ minutesAgo: 5, action: 'create_case', reason: 'Critical alert: a security case is created immediately and must be assigned to an analyst.' }] },
    // High: port scan against the perimeter, one event, window ended with no escalation: closed automatically.
    { id: 'alert-9006', minutesAgo: 210, severity: 'high', category: 'Reconnaissance', source: 'firewall', assetId: 'asset-021', identity: null, ruleId: 'fw-portscan', title: 'Inbound port scan detected', mitre: ['T1595'], lifecycle: 'auto_closed', caseId: null, assignee: null, evidence: 'Single inbound scan event blocked at the perimeter; no follow-on activity.', history: [{ minutesAgo: 150, action: 'auto_close', reason: 'Window ended with 1 related alert(s) (fewer than 5) and no compromise indicator or critical correlation.' }] },
    // Low: failed signature update on a finance workstation, marked as a false positive by an analyst.
    { id: 'alert-9007', minutesAgo: 300, severity: 'low', category: 'Endpoint protection', source: 'endpoint_agent', assetId: 'asset-011', identity: null, ruleId: 'av-update-failed', title: 'Endpoint protection signature update failed', mitre: [], lifecycle: 'false_positive', caseId: null, assignee: 'Lucas Brandt', evidence: 'Signature update failed once; subsequent update succeeded.', history: [] },
    // Critical: privileged account anomaly on the domain controller (case-5004, approval appr-3 pending).
    { id: 'alert-9009', minutesAgo: 25, severity: 'critical', category: 'Privileged account anomaly', source: 'identity_provider', assetId: 'asset-019', identity: 'svc-backup-admin', ruleId: 'priv-logon-new-host', title: 'Privileged account logon from an unseen host', mitre: ['T1078'], lifecycle: 'case_created', caseId: 'case-5004', assignee: 'Priya Raman', evidence: 'Domain administrator service account authenticated from a host never seen with this account.', history: [{ minutesAgo: 25, action: 'create_case', reason: 'Critical alert: a security case is created immediately and must be assigned to an analyst.' }] },
    // Critical: suspicious API access (case-5005, approval appr-4 pending).
    { id: 'alert-9010', minutesAgo: 18, severity: 'critical', category: 'Suspicious API access', source: 'api_gateway', assetId: 'asset-022', identity: 'api-key-7731', ruleId: 'api-bulk-export', title: 'Bulk export through a single API key', mitre: ['T1530'], lifecycle: 'case_created', caseId: 'case-5005', assignee: 'Daniel Mercer', evidence: 'One API key retrieved records at roughly 40 times its normal rate in ten minutes.', history: [{ minutesAgo: 18, action: 'create_case', reason: 'Critical alert: a security case is created immediately and must be assigned to an analyst.' }] },
    // Critical: cloud configuration risk on a storage bucket (case-5006, approval appr-5 rejected).
    { id: 'alert-9011', minutesAgo: 35, severity: 'critical', category: 'Cloud configuration risk', source: 'cloud_audit', assetId: 'asset-008', identity: null, ruleId: 'bucket-public-acl', title: 'Storage bucket changed to public read', mitre: ['T1530'], lifecycle: 'case_created', caseId: 'case-5006', assignee: 'Marcus Hale', evidence: 'Bucket access policy changed to allow anonymous reads.', history: [{ minutesAgo: 35, action: 'create_case', reason: 'Critical alert: a security case is created immediately and must be assigned to an analyst.' }] },
    // High: abnormal endpoint behaviour, still within its observation window: monitoring.
    { id: 'alert-9012', minutesAgo: 20, severity: 'high', category: 'Abnormal endpoint behaviour', source: 'endpoint_agent', assetId: 'asset-011', identity: 'lucas.brandt', ruleId: 'proc-unusual-parent', title: 'Unusual child process of Office application', mitre: ['T1204'], lifecycle: 'monitoring', caseId: null, assignee: null, evidence: 'A document application spawned a script interpreter once.', history: [{ minutesAgo: 20, action: 'monitor', reason: 'High alert under observation until the 60-minute window ends.' }] },
];

// Medium network-traffic group: seven events at 20-minute intervals over two hours → escalated (case-5007).
const NETWORK_GROUP_MINUTES = [130, 110, 90, 70, 50, 30, 10];
NETWORK_GROUP_MINUTES.forEach((m, i) => {
    ALERTS.push({
        id: i === 0 ? 'alert-9013' : `alert-${9016 + i}`, minutesAgo: m, severity: 'medium', category: 'Unusual network traffic', source: 'network_sensor', assetId: 'asset-017',
        identity: null, ruleId: 'net-beacon-interval', title: 'Periodic outbound beacon pattern', mitre: ['T1071'], lifecycle: 'case_created', caseId: 'case-5007', assignee: 'Sofia Alvarez',
        evidence: 'Regular outbound connection at a fixed interval to one external destination.',
        history: i === 6 ? [{ minutesAgo: 10, action: 'escalate_case', reason: 'Related activity continued for 2 hours without a gap longer than 30 minutes: escalated to a security case.' }] : [],
    });
});

export function buildSocSeed(nowMs: number, valueOf: (assetId: string) => string): { alerts: SocAlertRecord[]; cases: SocCaseRecord[]; approvals: SocApprovalRecord[] } {
    const at = (minutesAgo: number) => new Date(nowMs - minutesAgo * MIN).toISOString();
    const alerts: SocAlertRecord[] = ALERTS.map((a) => {
        const history: PolicyHistoryEntry[] = a.history.map((h) => ({
            at: at(h.minutesAgo), action: h.action, reason: h.reason, policy_version: POLICY_VERSION,
            evidence: { event_count: 1, longest_continuous_ms: 0, quiet_ms: 0, window_ends_at: null, highest_severity: a.severity },
        }));
        return {
            id: a.id, title: a.title, severity: a.severity, category: a.category, detection_source: a.source,
            asset_id: a.assetId, asset_value: valueOf(a.assetId), identity: a.identity, rule_id: a.ruleId, mitre_ids: a.mitre,
            correlation_key: `${a.ruleId}|${a.assetId}|${a.identity ?? '-'}`, lifecycle: a.lifecycle, evidence_summary: a.evidence,
            related_events: [{ at: at(a.minutesAgo), text: `${a.title} detected on ${valueOf(a.assetId)}.` }],
            detected_at: at(a.minutesAgo), assigned_to: a.assignee, case_id: a.caseId, policy_history: history,
        };
    });

    const alertsOf = (caseId: string) => alerts.filter((a) => a.case_id === caseId).map((a) => a.id);
    const caseSpec = (id: string, title: string, severity: SocCaseRecord['severity'], status: SocCaseRecord['status'], tier: number, assetId: string, assignee: string | null, created: number, updated: number, mitre: { id: string; tactic: string }[], timeline: { minutesAgo: number; text: string }[], notes: { minutesAgo: number; author: string; text: string }[], actions: { action: string; target: string; requires_approval: boolean }[], approvalIds: string[], extra: Partial<SocCaseRecord> = {}): SocCaseRecord => ({
        id, title, severity, status, tier, correlation_key: alerts.find((a) => a.case_id === id)?.correlation_key ?? null,
        asset_ids: [assetId], alert_ids: alertsOf(id), assigned_to: assignee, created_at: at(created), updated_at: at(updated),
        timeline: timeline.map((t) => ({ at: at(t.minutesAgo), text: t.text })), notes: notes.map((n, i) => ({ id: `${id}-note-${i + 1}`, at: at(n.minutesAgo), author: n.author, text: n.text })),
        recommended_actions: actions.map((x, i) => ({ id: `${id}-act-${i + 1}`, action: x.action, target: x.target, requires_approval: x.requires_approval, simulated: true as const })),
        approval_ids: approvalIds, auto_closed: false, escalated: false, mitre,
        ...extra,
    });

    const cases: SocCaseRecord[] = [
        caseSpec('case-5001', 'Multiple SSH authentication failures on web-edge-01', 'high', 'investigating', 2, 'asset-001', 'Daniel Mercer', 50, 12,
            [{ id: 'T1110', tactic: 'Credential Access' }],
            [{ minutesAgo: 40, text: 'Escalated to a case: five related high alerts within one hour.' }, { minutesAgo: 10, text: 'Source address checked against threat-intelligence lists.' }],
            [{ minutesAgo: 20, author: 'Daniel Mercer', text: 'Root login attempts from one address. Checking whether password authentication is enabled.' }],
            [{ action: 'Block source address at the perimeter', target: '185.220.101.47', requires_approval: true }], [], { escalated: true }),
        caseSpec('case-5002', 'Suspicious WebLogic deserialization payload on app-weblogic-01', 'critical', 'investigating', 3, 'asset-003', 'Priya Raman', 40, 15,
            [{ id: 'T1190', tactic: 'Initial Access' }, { id: 'T1059', tactic: 'Execution' }],
            [{ minutesAgo: 40, text: 'Case created immediately from a critical alert.' }, { minutesAgo: 35, text: 'Block request raised for approval.' }, { minutesAgo: 15, text: 'Human approval recorded for the source-address block (simulated).' }],
            [{ minutesAgo: 30, author: 'Priya Raman', text: 'Payload confirmed as a known gadget chain. Patch to be scheduled by the owner.' }],
            [{ action: 'Block source address', target: '45.155.205.90', requires_approval: true }], ['appr-1']),
        caseSpec('case-5003', 'Outbound connection to a known malicious address from k8s-node-01', 'critical', 'open', 2, 'asset-023', 'Daniel Mercer', 5, 5,
            [{ id: 'T1071', tactic: 'Command and Control' }],
            [{ minutesAgo: 5, text: 'Case created immediately from a critical alert.' }],
            [], [{ action: 'Isolate workload from the network (requires approval; not executed)', target: 'k8s-node-01.internal', requires_approval: true }], ['appr-2']),
        caseSpec('case-4987', 'Unsupported Windows 10 build flagged by vulnerability scan', 'medium', 'resolved', 1, 'asset-016', 'Lucas Brandt', 60 * 24 * 5, 60 * 24 * 3,
            [],
            [{ minutesAgo: 60 * 24 * 5, text: 'Opened from a vulnerability finding.' }, { minutesAgo: 60 * 24 * 3, text: 'Remediation plan accepted; closed pending hardware refresh.' }],
            [], [], []),
        caseSpec('case-5004', 'Privileged service account logon from an unseen host on dc-01', 'critical', 'open', 3, 'asset-019', 'Priya Raman', 25, 25,
            [{ id: 'T1078', tactic: 'Persistence' }],
            [{ minutesAgo: 25, text: 'Case created immediately from a critical alert.' }],
            [], [{ action: 'Reset the service account credentials (requires approval; not executed)', target: 'svc-backup-admin', requires_approval: true }], ['appr-3']),
        caseSpec('case-5005', 'Bulk data export through one API key', 'critical', 'open', 3, 'asset-022', 'Daniel Mercer', 18, 18,
            [{ id: 'T1530', tactic: 'Collection' }],
            [{ minutesAgo: 18, text: 'Case created immediately from a critical alert.' }],
            [], [{ action: 'Revoke the API key (requires approval; not executed)', target: 'api-key-7731', requires_approval: true }], ['appr-4']),
        caseSpec('case-5006', 'Storage bucket changed to public read', 'critical', 'open', 2, 'asset-008', 'Marcus Hale', 35, 30,
            [{ id: 'T1530', tactic: 'Collection' }],
            [{ minutesAgo: 35, text: 'Case created immediately from a critical alert.' }, { minutesAgo: 30, text: 'Restriction request declined by the approver; reason recorded.' }],
            [], [{ action: 'Restrict bucket access policy (requires approval; not executed)', target: 'reports-bucket.ncc-soc.demo', requires_approval: true }], ['appr-5']),
        caseSpec('case-5007', 'Periodic outbound beacon pattern from 10.20.6.30', 'medium', 'investigating', 2, 'asset-017', 'Sofia Alvarez', 130, 10,
            [{ id: 'T1071', tactic: 'Command and Control' }],
            [{ minutesAgo: 130, text: 'First beacon observed.' }, { minutesAgo: 10, text: 'Escalated: activity continued for two hours.' }],
            [], [{ action: 'Capture and review outbound flow records', target: '10.20.6.30', requires_approval: false }], [], { escalated: true }),
    ];

    const approvals: SocApprovalRecord[] = [
        { id: 'appr-1', case_id: 'case-5002', alert_id: 'alert-9002', asset_id: 'asset-003', action: 'block_ip', target: '45.155.205.90', severity: 'critical', status: 'approved',
          requested_at: at(35), requested_by: 'SOC policy (critical-alert rule)', approver: 'Marcus Hale', explanation: 'Policy: a critical exploit attempt requires a human decision before any source block. Advisory only.',
          evidence: ['alert-9002: deserialization gadget chain matched', 'Source address on two public blocklists'], risk_impact: 'Blocking this address would stop the observed source; no other service depends on it.',
          sla_due_at: at(-200), decided_at: at(15), decided_by: 'Marcus Hale', decision_reason: 'Confirmed hostile; block approved.',
          history: [{ at: at(35), actor: 'SOC policy', action: 'requested', reason: null }, { at: at(15), actor: 'Marcus Hale', action: 'approved', reason: 'Confirmed hostile; block approved.' }] },
        { id: 'appr-2', case_id: 'case-5003', alert_id: 'alert-9005', asset_id: 'asset-023', action: 'isolate_agent', target: 'k8s-node-01.internal', severity: 'critical', status: 'pending',
          requested_at: at(4), requested_by: 'SOC policy (critical-alert rule)', approver: 'Daniel Mercer', explanation: 'Policy: isolating a workload is a sensitive response and needs a human decision.',
          evidence: ['alert-9005: egress to a threat-intelligence indicator'], risk_impact: 'Isolating the node would interrupt the workloads it hosts.',
          sla_due_at: at(-55), decided_at: null, decided_by: null, decision_reason: null, history: [{ at: at(4), actor: 'SOC policy', action: 'requested', reason: null }] },
        { id: 'appr-3', case_id: 'case-5004', alert_id: 'alert-9009', asset_id: 'asset-019', action: 'reset_credentials', target: 'svc-backup-admin', severity: 'critical', status: 'pending',
          requested_at: at(25), requested_by: 'SOC policy (critical-alert rule)', approver: 'Priya Raman', explanation: 'Policy: a privileged credential reset requires a human decision.',
          evidence: ['alert-9009: logon from an unseen host'], risk_impact: 'Resetting this account would break the backup job until the new credential is configured.',
          sla_due_at: at(-35), decided_at: null, decided_by: null, decision_reason: null, history: [{ at: at(25), actor: 'SOC policy', action: 'requested', reason: null }] },
        { id: 'appr-4', case_id: 'case-5005', alert_id: 'alert-9010', asset_id: 'asset-022', action: 'revoke_api_key', target: 'api-key-7731', severity: 'critical', status: 'pending',
          requested_at: at(18), requested_by: 'SOC policy (critical-alert rule)', approver: 'Daniel Mercer', explanation: 'Policy: revoking a key is a sensitive response and needs a human decision.',
          evidence: ['alert-9010: bulk export at ~40x normal rate'], risk_impact: 'Revoking the key would stop the integration that uses it.',
          sla_due_at: at(-42), decided_at: null, decided_by: null, decision_reason: null, history: [{ at: at(18), actor: 'SOC policy', action: 'requested', reason: null }] },
        { id: 'appr-5', case_id: 'case-5006', alert_id: 'alert-9011', asset_id: 'asset-008', action: 'restrict_bucket', target: 'reports-bucket.ncc-soc.demo', severity: 'critical', status: 'rejected',
          requested_at: at(35), requested_by: 'SOC policy (critical-alert rule)', approver: 'Marcus Hale', explanation: 'Policy: changing a storage access policy needs a human decision.',
          evidence: ['alert-9011: bucket changed to public read'], risk_impact: 'Restricting the bucket may break the public report download link.',
          sla_due_at: at(-5), decided_at: at(30), decided_by: 'Marcus Hale', decision_reason: 'Restriction declined: the link is intentional. Owner will confirm the access list separately.',
          history: [{ at: at(35), actor: 'SOC policy', action: 'requested', reason: null }, { at: at(30), actor: 'Marcus Hale', action: 'rejected', reason: 'Restriction declined: the link is intentional. Owner will confirm the access list separately.' }] },
    ];

    return { alerts, cases, approvals };
}
