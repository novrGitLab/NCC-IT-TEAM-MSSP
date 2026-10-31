// NovaSOC NCC — DEMONSTRATION FIXTURE. Shaped to match the real `Finding`/`Detail` interfaces in
// `FindingDetail.tsx`, the `Risk` interface in `VmsRisk.tsx`, and `VmsScan` in `@/lib/vms` exactly,
// so the existing Findings / Finding Detail / Remediation / Risk / Scans pages render without any
// component changes. Not real vulnerability data — coherent sample data only. Every derived count
// below is computed from these arrays, never hand-typed, so a number shown in one place can't drift
// from the records that back it.
import { byAssetId, DEMO_ASSETS } from './assets';
import type { VmsScan } from '@/lib/vms';

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

export type FindingStatus = 'open' | 'acknowledged' | 'in_progress' | 'fixed_pending_verification' | 'verified' | 'reopened' | 'risk_accepted' | 'false_positive';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export interface DemoFinding {
    id: string; asset_id: string | null; asset_value: string; port: number | null; protocol: string | null;
    source_class: 'active_scan' | 'wazuh'; detected_by: string[]; rule_id: string; title: string; finding_type: string;
    cve_ids: string[]; scanner_severity: Severity; scanner_cvss: number | null; risk_score: number | null;
    priority: Priority | null; status: FindingStatus; owner: string | null; due_at: string | null;
    first_seen: string; last_seen: string; verified_at: string | null; case_id: string | null;
    description?: string | null; remediation?: string | null; references_urls?: string[];
    patch_available: boolean; // NovaSOC NCC demo field, surfaced in `remediation` text for the existing UI
    evidence_class?: string | null;
}

// Patch/remediation guidance text — folds "patch availability" (a spec-required field with no
// dedicated column in the retained UI) into the `remediation` text every finding card/detail shows.
const remediationText = (patchAvailable: boolean, guidance: string) =>
    `${patchAvailable ? 'Patch available' : 'No vendor patch available yet'} — ${guidance}`;

export const DEMO_FINDINGS: DemoFinding[] = [
    { id: 'find-001', asset_id: 'asset-003', asset_value: byAssetId('asset-003')!.value, port: 7001, protocol: 'tcp', source_class: 'active_scan', detected_by: ['vuln_nuclei'], rule_id: 'CVE-2024-21216-weblogic-rce', title: 'Oracle WebLogic Server deserialization RCE', finding_type: 'vulnerability', cve_ids: ['CVE-2024-21216'], scanner_severity: 'critical', scanner_cvss: 9.8, risk_score: 96, priority: 'P1', status: 'verified', owner: 'David Chen', due_at: daysAgo(4), first_seen: daysAgo(6), last_seen: daysAgo(1), verified_at: daysAgo(1), case_id: 'case-1002', patch_available: true, remediation: remediationText(true, 'apply Oracle CPU July 2024 and restart the managed server'), description: 'Unauthenticated remote code execution via T3/IIOP deserialization on the WebLogic console port.' },
    { id: 'find-002', asset_id: 'asset-001', asset_value: byAssetId('asset-001')!.value, port: 443, protocol: 'tcp', source_class: 'active_scan', detected_by: ['ports'], rule_id: 'weak-tls-cipher', title: 'Outdated TLS cipher suite accepted', finding_type: 'misconfiguration', cve_ids: [], scanner_severity: 'medium', scanner_cvss: 5.3, risk_score: 41, priority: 'P2', status: 'in_progress', owner: 'Mariam Okafor', due_at: daysAgo(-3), first_seen: daysAgo(10), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: true, remediation: remediationText(true, 'disable TLS 1.0/1.1 and RC4/3DES ciphers in the nginx TLS profile'), description: 'Server accepts TLS 1.0 with RC4 as a fallback cipher.' },
    { id: 'find-003', asset_id: 'asset-005', asset_value: byAssetId('asset-005')!.value, port: 5432, protocol: 'tcp', source_class: 'active_scan', detected_by: ['ports'], rule_id: 'pg-no-client-cert', title: 'PostgreSQL exposed on internal interface without client cert', finding_type: 'misconfiguration', cve_ids: [], scanner_severity: 'medium', scanner_cvss: 6.1, risk_score: 52, priority: 'P2', status: 'risk_accepted', owner: 'Chinedu Obi', due_at: null, first_seen: daysAgo(20), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: false, remediation: remediationText(false, 'mitigate with network ACLs; mutual-TLS enforcement tracked as a separate infra project'), description: 'Database accepts password auth from the whole app subnet; no client certificate required.' },
    { id: 'find-004', asset_id: 'asset-009', asset_value: byAssetId('asset-009')!.value, port: 443, protocol: 'tcp', source_class: 'active_scan', detected_by: ['discovery'], rule_id: 'CVE-2025-30123-opnsense', title: 'OPNsense outdated firmware', finding_type: 'vulnerability', cve_ids: ['CVE-2025-30123'], scanner_severity: 'medium', scanner_cvss: 6.5, risk_score: 58, priority: 'P2', status: 'fixed_pending_verification', owner: 'Ngozi Adeyemi', due_at: daysAgo(-1), first_seen: daysAgo(15), last_seen: daysAgo(2), verified_at: null, case_id: null, patch_available: true, remediation: remediationText(true, 'upgrade to OPNsense 24.7.6 or later; firmware staged for the next maintenance window'), description: 'Firewall OS build predates a published security advisory.' },
    { id: 'find-005', asset_id: 'asset-013', asset_value: byAssetId('asset-013')!.value, port: 9229, protocol: 'tcp', source_class: 'active_scan', detected_by: ['vuln_nuclei'], rule_id: 'exposed-debug-endpoint', title: 'Exposed developer debug endpoint', finding_type: 'exposure', cve_ids: [], scanner_severity: 'critical', scanner_cvss: 8.2, risk_score: 74, priority: 'P1', status: 'open', owner: null, due_at: daysAgo(-1), first_seen: daysAgo(1), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: false, remediation: remediationText(false, 'close the Node.js inspector port (9229) or bind it to loopback only'), description: 'Node.js inspector protocol reachable from the internal network with no auth.' },
    { id: 'find-006', asset_id: 'asset-016', asset_value: byAssetId('asset-016')!.value, port: null, protocol: null, source_class: 'wazuh', detected_by: ['wazuh'], rule_id: 'eol-windows-10', title: 'Unsupported Windows 10 build (end of life)', finding_type: 'vulnerability', cve_ids: [], scanner_severity: 'high', scanner_cvss: 7.5, risk_score: 68, priority: 'P1', status: 'reopened', owner: 'Ngozi Adeyemi', due_at: daysAgo(-6), first_seen: daysAgo(30), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: false, remediation: remediationText(false, 'no further vendor updates; decommission or replace the device'), description: 'Host reports a Windows 10 build past Microsoft end-of-support.' },
    { id: 'find-007', asset_id: 'asset-011', asset_value: byAssetId('asset-011')!.value, port: 445, protocol: 'tcp', source_class: 'active_scan', detected_by: ['vuln_nuclei'], rule_id: 'CVE-2017-0144-smbv1', title: 'SMBv1 enabled', finding_type: 'vulnerability', cve_ids: ['CVE-2017-0144'], scanner_severity: 'high', scanner_cvss: 8.1, risk_score: 70, priority: 'P1', status: 'verified', owner: 'David Chen', due_at: daysAgo(6), first_seen: daysAgo(8), last_seen: daysAgo(1), verified_at: daysAgo(1), case_id: 'case-1002', patch_available: true, remediation: remediationText(true, 'disable the SMBv1 feature via Windows Features / Group Policy'), description: 'Legacy SMBv1 protocol still enabled, exploitable by EternalBlue-class worms.' },
    { id: 'find-008', asset_id: 'asset-004', asset_value: byAssetId('asset-004')!.value, port: 7001, protocol: 'tcp', source_class: 'active_scan', detected_by: ['ports'], rule_id: 'weblogic-console-no-mfa', title: 'WebLogic console reachable from internal network without MFA', finding_type: 'misconfiguration', cve_ids: [], scanner_severity: 'medium', scanner_cvss: 6.4, risk_score: 54, priority: 'P2', status: 'acknowledged', owner: 'Mariam Okafor', due_at: daysAgo(-5), first_seen: daysAgo(12), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: false, remediation: remediationText(false, 'front the console with the SSO proxy and enforce MFA at the reverse proxy'), description: 'Admin console accessible to any host on the internal app subnet.' },
    { id: 'find-009', asset_id: 'asset-017', asset_value: byAssetId('asset-017')!.value, port: null, protocol: null, source_class: 'active_scan', detected_by: ['discovery'], rule_id: 'lambda-overprivileged-role', title: 'Lambda execution role over-privileged (wildcard S3)', finding_type: 'misconfiguration', cve_ids: [], scanner_severity: 'low', scanner_cvss: 4.2, risk_score: 28, priority: 'P3', status: 'open', owner: null, due_at: daysAgo(-27), first_seen: daysAgo(2), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: true, remediation: remediationText(true, 'scope the IAM role to the specific bucket/prefix the function needs'), description: 'Execution role grants s3:* on arn:aws:s3:::* rather than the one bucket it reads.' },
    { id: 'find-010', asset_id: 'asset-007', asset_value: byAssetId('asset-007')!.value, port: 22, protocol: 'tcp', source_class: 'active_scan', detected_by: ['discovery'], rule_id: 'sg-open-ssh-world', title: 'Security group allows 0.0.0.0/0 on port 22', finding_type: 'exposure', cve_ids: [], scanner_severity: 'critical', scanner_cvss: 8.9, risk_score: 82, priority: 'P1', status: 'open', owner: 'Chinedu Obi', due_at: daysAgo(-2), first_seen: daysAgo(4), last_seen: daysAgo(0), verified_at: null, case_id: 'case-1004', patch_available: true, remediation: remediationText(true, 'restrict the security group to the VPN CIDR and remove the 0.0.0.0/0 rule'), description: 'Inbound SSH open to the entire internet on a production VPC security group.' },
    { id: 'find-011', asset_id: 'asset-014', asset_value: byAssetId('asset-014')!.value, port: 443, protocol: 'tcp', source_class: 'active_scan', detected_by: ['vuln_nuclei'], rule_id: 'CVE-2024-6119-openssl', title: 'Outdated OpenSSL library', finding_type: 'vulnerability', cve_ids: ['CVE-2024-6119'], scanner_severity: 'low', scanner_cvss: 3.7, risk_score: 19, priority: 'P4', status: 'false_positive', owner: 'David Chen', due_at: null, first_seen: daysAgo(25), last_seen: daysAgo(20), verified_at: null, case_id: null, patch_available: true, remediation: remediationText(true, 'confirmed not exploitable on this build after manual review; no action needed'), description: 'Scanner flagged a vulnerable OpenSSL version string; manual review found the vulnerable code path is compiled out.' },
    { id: 'find-012', asset_id: 'asset-002', asset_value: byAssetId('asset-002')!.value, port: 443, protocol: 'tcp', source_class: 'active_scan', detected_by: ['ports'], rule_id: 'verbose-server-banner', title: 'Verbose server banner discloses stack version', finding_type: 'exposure', cve_ids: [], scanner_severity: 'info', scanner_cvss: 2.1, risk_score: 8, priority: 'P4', status: 'open', owner: null, due_at: daysAgo(-62), first_seen: daysAgo(1), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: true, remediation: remediationText(true, 'set `server_tokens off;` in the nginx config'), description: 'HTTP response headers disclose the exact nginx version.' },
    { id: 'find-013', asset_id: 'asset-015', asset_value: byAssetId('asset-015')!.value, port: 25, protocol: 'tcp', source_class: 'wazuh', detected_by: ['wazuh'], rule_id: 'mail-relay-open-check', title: 'SMTP open-relay check recommended after config change', finding_type: 'misconfiguration', cve_ids: [], scanner_severity: 'medium', scanner_cvss: 5.0, risk_score: 38, priority: 'P3', status: 'in_progress', owner: 'Mariam Okafor', due_at: daysAgo(-18), first_seen: daysAgo(3), last_seen: daysAgo(0), verified_at: null, case_id: null, patch_available: false, remediation: remediationText(false, 'relay-test scheduled after the recent Postfix config change'), description: 'Recent mail gateway config change flagged for a relay-abuse re-check.' },
    { id: 'find-014', asset_id: 'asset-018', asset_value: byAssetId('asset-018')!.value, port: 23, protocol: 'tcp', source_class: 'active_scan', detected_by: ['ports'], rule_id: 'telnet-enabled', title: 'Telnet management enabled on DMZ switch', finding_type: 'misconfiguration', cve_ids: [], scanner_severity: 'high', scanner_cvss: 7.2, risk_score: 63, priority: 'P2', status: 'verified', owner: 'Ngozi Adeyemi', due_at: daysAgo(9), first_seen: daysAgo(14), last_seen: daysAgo(1), verified_at: daysAgo(1), case_id: null, patch_available: true, remediation: remediationText(true, 'disable Telnet and enforce SSHv2 management only'), description: 'Unencrypted Telnet management interface reachable on the DMZ switch.' },
];

export const findingAssetCriticality = (f: DemoFinding) => byAssetId(f.asset_id)?.criticality ?? null;

const CLOSED: FindingStatus[] = ['verified', 'risk_accepted', 'false_positive'];
export const isOverdueFinding = (f: DemoFinding) => !!f.due_at && Date.parse(f.due_at) < now && !CLOSED.includes(f.status);

export const findingsByStatusGroup = (statusParam: string | null): DemoFinding[] => {
    if (!statusParam || statusParam === 'open_all') return DEMO_FINDINGS.filter((f) => !CLOSED.includes(f.status));
    const wanted = new Set(statusParam.split(','));
    if (wanted.has('all')) return DEMO_FINDINGS;
    return DEMO_FINDINGS.filter((f) => wanted.has(f.status));
};

// Mutation support — so an action button's "success" is real, not a lie. Every PATCH the router
// wires below mutates these objects in place; every summary/derived export below is therefore a
// FUNCTION, called fresh per request, never a one-time snapshot that would silently go stale.
export function patchFinding(id: string, changes: Partial<Pick<DemoFinding, 'status' | 'owner' | 'due_at'>>) {
    const f = DEMO_FINDINGS.find((x) => x.id === id);
    if (!f) return null;
    if (changes.status !== undefined) { f.status = changes.status; if (changes.status === 'verified') f.verified_at = new Date().toISOString(); }
    if (changes.owner !== undefined) f.owner = changes.owner;
    if (changes.due_at !== undefined) f.due_at = changes.due_at;
    f.last_seen = new Date().toISOString();
    return f;
}

const TASK_STATUS_TO_FINDING_STATUS: Record<string, FindingStatus> = { todo: 'open', doing: 'in_progress', done: 'fixed_pending_verification', cancelled: 'risk_accepted' };
export function patchTaskByTaskId(taskId: string, changes: { status?: 'todo' | 'doing' | 'done' | 'cancelled'; owner?: string | null; due_at?: string | null }) {
    const findingId = taskId.replace(/^task-/, '');
    const mapped = changes.status ? TASK_STATUS_TO_FINDING_STATUS[changes.status] : undefined;
    return patchFinding(findingId, { ...(mapped ? { status: mapped } : {}), ...(changes.owner !== undefined ? { owner: changes.owner } : {}), ...(changes.due_at !== undefined ? { due_at: changes.due_at } : {}) });
}

// AI-suggested remediation tasks created from VmsRemediationPlus — appended here, included by getTasks().
export const DEMO_EXTRA_TASKS: { id: string; finding_id: string; title: string; details: string | null; owner: string | null; due_at: string | null; status: 'todo' | 'doing' | 'done' | 'cancelled'; ai_artifact_id: string | null; created_by: string; created_at: string; completed_at: string | null }[] = [];
export function addExtraTask(findingId: string, body: { title: string; details?: string; owner?: string; due_at?: string; ai_artifact_id?: string | null }) {
    const task = { id: `task-ai-${DEMO_EXTRA_TASKS.length + 1}`, finding_id: findingId, title: body.title, details: body.details ?? null, owner: body.owner ?? null, due_at: body.due_at ?? null, status: 'todo' as const, ai_artifact_id: body.ai_artifact_id ?? null, created_by: 'AI Analyst (demo)', created_at: new Date().toISOString(), completed_at: null };
    DEMO_EXTRA_TASKS.push(task);
    return task;
}

// Summary — matches VmsFindings.tsx's `Summary` interface exactly.
export function getFindingsSummary() {
    const open = DEMO_FINDINGS.filter((f) => !CLOSED.includes(f.status));
    const by = <T extends string>(list: DemoFinding[], key: 'scanner_severity' | 'priority') => {
        const out: Record<string, number> = {};
        for (const f of list) { const k = (f[key] ?? 'unknown') as T; out[k] = (out[k] ?? 0) + 1; }
        return out;
    };
    return {
        open: open.length,
        by_severity: by(open, 'scanner_severity'),
        by_priority: by(open, 'priority'),
        known_exploited_open: open.filter((f) => f.cve_ids.length > 0 && f.scanner_severity === 'critical').length,
        overdue: open.filter(isOverdueFinding).length,
        by_source: open.reduce<Record<string, number>>((acc, f) => { acc[f.source_class] = (acc[f.source_class] ?? 0) + 1; return acc; }, {}),
    };
}

// Detail — matches FindingDetail.tsx's `Detail` interface.
export function findingDetail(id: string) {
    const finding = DEMO_FINDINGS.find((f) => f.id === id);
    if (!finding) return null;
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
            kev: finding.scanner_severity === 'critical', kev_checked_at: daysAgo(0), kev_date_added: finding.scanner_severity === 'critical' ? finding.first_seen : null, kev_required_action: finding.scanner_severity === 'critical' ? 'Apply vendor patch or mitigation.' : null, kev_ransomware: 'Unknown',
        })),
        correlated: [],
        correlation_error: null,
    };
}

// Risk — best-effort coverage of VmsRisk.tsx's `Risk` interface (model/thresholds are fixed display
// config, not data that needs to vary; totals/matrix/queue are all derived from DEMO_FINDINGS).
export function getRisk() {
    const open = DEMO_FINDINGS.filter((f) => !CLOSED.includes(f.status));
    const by_priority: Record<string, number> = {};
    for (const f of open) { const k = f.priority ?? 'P4'; by_priority[k] = (by_priority[k] ?? 0) + 1; }
    const bands = [['critical', 80], ['high', 60], ['medium', 30], ['low', 0]] as const;
    const score_bands = bands.map(([band, min], i) => ({ band, count: open.filter((f) => (f.risk_score ?? 0) >= min && (f.risk_score ?? 0) < (i === 0 ? 1000 : bands[i - 1][1])).length }));
    const matrix: Record<string, Record<string, number>> = {};
    for (const f of open) {
        const exp = byAssetId(f.asset_id)?.exposure ?? 'unknown';
        matrix[f.scanner_severity] ??= {};
        matrix[f.scanner_severity][exp] = (matrix[f.scanner_severity][exp] ?? 0) + 1;
    }
    const kevFindings = open.filter((f) => f.cve_ids.length > 0 && f.scanner_severity === 'critical');
    const queue = open.map((f) => ({
        id: f.id, title: f.title, asset_id: f.asset_id, asset_value: f.asset_value, severity: f.scanner_severity, cvss: f.scanner_cvss, priority: f.priority, risk_score: f.risk_score,
        kev: kevFindings.includes(f), epss: f.scanner_severity === 'critical' ? 0.42 : 0.05, exposure: byAssetId(f.asset_id)?.exposure ?? 'unknown', criticality: byAssetId(f.asset_id)?.criticality ?? null,
        status: f.status, due_at: f.due_at, overdue: isOverdueFinding(f), owner: f.owner,
        factors: { technical: { points: Math.round((f.scanner_cvss ?? 0) * 6), basis: 'scanner_cvss' }, exploitation: { points: kevFindings.includes(f) ? 20 : 5, basis: 'kev/epss' }, exposure: { points: byAssetId(f.asset_id)?.exposure === 'internet' ? 15 : 5, basis: 'exposure' }, criticality: { points: byAssetId(f.asset_id)?.criticality === 'critical' ? 15 : 5, basis: 'asset criticality' } },
        evidence_class: f.source_class,
    })).sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
    const trend = Array.from({ length: 14 }, (_, i) => {
        const d = daysAgo(13 - i).slice(0, 10);
        return { day: d, kev_open: kevFindings.length, internet_open: open.filter((f) => byAssetId(f.asset_id)?.exposure === 'internet').length, critical_exposures: open.filter((f) => f.scanner_severity === 'critical').length, risk_mean: Math.round(open.reduce((s, f) => s + (f.risk_score ?? 0), 0) / Math.max(open.length, 1)), by_priority };
    });
    return {
        model: {
            weights: { technical: 0.4, exploitation: 0.25, exposure: 0.2, criticality: 0.15 },
            due_days: { P1: 2, P2: 7, P3: 30, P4: 90 },
            thresholds: { critical: '80+', high: '60-79', medium: '30-59', low: '0-29' },
            components: { technical: 'Scanner CVSS', exploitation: 'KEV / EPSS', exposure: 'Internet vs internal', criticality: 'Asset business criticality' },
            evidence_rule: 'A finding needs at least one corroborating scan or Wazuh detection before it counts toward risk.',
            source: 'NovaSOC NCC demo risk model (static weights for this preview build)',
        },
        totals: { open: open.length, with_cve: open.filter((f) => f.cve_ids.length > 0).length, kev: kevFindings.length, overdue: open.filter(isOverdueFinding).length },
        by_priority, score_bands, matrix,
        epss: { kev: 0.9, epss_high: 0.08, epss_low: 0.02, unknown: 0.0 },
        exposure: { internet: open.filter((f) => byAssetId(f.asset_id)?.exposure === 'internet').length, internal: open.filter((f) => byAssetId(f.asset_id)?.exposure === 'internal').length },
        kev_findings: kevFindings.map((f) => ({ id: f.id, title: f.title, asset_value: f.asset_value, exposure: byAssetId(f.asset_id)?.exposure ?? 'unknown', priority: f.priority, cve_ids: f.cve_ids, due_at: f.due_at, overdue: isOverdueFinding(f) })),
        queue, trend,
    };
}

export const DEMO_SCANS: VmsScan[] = [
    { id: 'scan-101', scope_id: 'scope-1', kind: 'discovery', targets: ['External perimeter'], options: {}, status: 'succeeded', requested_by: 'Mariam Okafor', requested_at: daysAgo(4), started_at: daysAgo(4), finished_at: daysAgo(4), progress: { phase: 'done', done: 1, total: 1 }, error: null, summary: { findings: 2 }, worker_id: 'worker-01', heartbeat_at: daysAgo(4), cancel_requested: false },
    { id: 'scan-102', scope_id: 'scope-1', kind: 'ports', targets: ['10.20.0.0/24'], options: { ports: '1-1024' }, status: 'succeeded', requested_by: 'David Chen', requested_at: daysAgo(8), started_at: daysAgo(8), finished_at: daysAgo(8), progress: { phase: 'done', done: 1, total: 1 }, error: null, summary: { findings: 3 }, worker_id: 'worker-01', heartbeat_at: daysAgo(8), cancel_requested: false },
    { id: 'scan-103', scope_id: 'scope-1', kind: 'vuln_nuclei', targets: ['web-edge-01.novasoc-ncc.demo', 'web-edge-02.novasoc-ncc.demo'], options: {}, status: 'succeeded', requested_by: 'Chinedu Obi', requested_at: daysAgo(1), started_at: daysAgo(1), finished_at: daysAgo(1), progress: { phase: 'done', done: 1, total: 1 }, error: null, summary: { findings: 2 }, worker_id: 'worker-01', heartbeat_at: daysAgo(1), cancel_requested: false },
    { id: 'scan-104', scope_id: 'scope-1', kind: 'vuln_nuclei', targets: ['app-weblogic-01.internal'], options: {}, status: 'succeeded', requested_by: 'David Chen', requested_at: daysAgo(6), started_at: daysAgo(6), finished_at: daysAgo(6), progress: { phase: 'done', done: 1, total: 1 }, error: null, summary: { findings: 1 }, worker_id: 'worker-01', heartbeat_at: daysAgo(6), cancel_requested: false },
    { id: 'scan-105', scope_id: 'scope-1', kind: 'discovery', targets: ['Cloud VPC — prod'], options: {}, status: 'running', requested_by: 'Ngozi Adeyemi', requested_at: daysAgo(0), started_at: daysAgo(0), finished_at: null, progress: { phase: 'enumerating', done: 3, total: 10, message: 'Enumerating cloud resources' }, error: null, summary: null, worker_id: 'worker-01', heartbeat_at: daysAgo(0), cancel_requested: false },
    { id: 'scan-106', scope_id: 'scope-1', kind: 'vuln_openvas', targets: ['db-primary-01.internal'], options: {}, status: 'queued', requested_by: 'Chinedu Obi', requested_at: daysAgo(0), started_at: null, finished_at: null, progress: {}, error: null, summary: null, worker_id: null, heartbeat_at: null, cancel_requested: false, attention: 'OpenVAS scanning is disabled in this demo environment — this job will not run.' },
];

// Remediation board — `Item = Finding & { overdue, tasks }` per VmsRemediation.tsx.
export function getRemediationItems() {
    return DEMO_FINDINGS
        .filter((f) => !CLOSED.includes(f.status) || f.status === 'verified')
        .map((f) => ({ ...f, overdue: isOverdueFinding(f), tasks: f.status !== 'verified' ? [{ id: `task-${f.id}`, title: `Remediate: ${f.title}`, status: f.status === 'open' ? 'todo' : f.status === 'in_progress' ? 'doing' : 'doing', owner: f.owner, due_at: f.due_at }] : [] }));
}

export function getTasks() {
    const fromFindings = DEMO_FINDINGS.filter((f) => !CLOSED.includes(f.status)).map((f) => ({
        id: `task-${f.id}`, finding_id: f.id, title: `Remediate: ${f.title}`, details: f.remediation ?? null, owner: f.owner, due_at: f.due_at,
        status: (f.status === 'fixed_pending_verification' ? 'done' : f.status === 'in_progress' || f.status === 'acknowledged' ? 'doing' : 'todo') as 'todo' | 'doing' | 'done' | 'cancelled',
        ai_artifact_id: null, created_by: 'system', created_at: f.first_seen, completed_at: f.status === 'fixed_pending_verification' ? f.last_seen : null, overdue: isOverdueFinding(f),
        finding: { id: f.id, title: f.title, asset_value: f.asset_value, scanner_severity: f.scanner_severity, priority: f.priority, status: f.status },
    }));
    const extra = DEMO_EXTRA_TASKS.map((t) => {
        const f = DEMO_FINDINGS.find((x) => x.id === t.finding_id);
        return { ...t, overdue: !!t.due_at && Date.parse(t.due_at) < now, finding: f ? { id: f.id, title: f.title, asset_value: f.asset_value, scanner_severity: f.scanner_severity, priority: f.priority, status: f.status } : null };
    });
    return [...fromFindings, ...extra];
}

// Single-number risk score for the simpler client-portal summary widget (0-100, higher = worse).
export function getRiskScore() {
    const open = DEMO_FINDINGS.filter((f) => !CLOSED.includes(f.status));
    return Math.round(open.reduce((s, f) => s + (f.risk_score ?? 0), 0) / Math.max(open.length, 1));
}

// VMS overview (admin "Overview" tab) — matches VmsAssetMgmt.tsx's `Overview` interface exactly.
export const DEMO_VMS_OVERVIEW = {
    assets: { active: DEMO_ASSETS.filter((a) => a.status === 'active').length, internet_facing: DEMO_ASSETS.filter((a) => a.exposure === 'internet').length, gone: DEMO_ASSETS.filter((a) => a.status === 'gone').length, open_services: Object.values({}).length || 3 },
    last_7_days: { new_assets: 1, changed_assets: 3, gone_assets: 0, new_services: 2 },
    active_scopes: 1,
};
