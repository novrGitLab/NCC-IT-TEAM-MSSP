// NCC IT — ILLUSTRATIVE FIXTURE. Sample cases/incidents for the retained SecOps pages
// (/api/cases and friends). Tied to DEMO_ALERTS' case_id values where applicable.

const now = Date.now();
const minsAgo = (n: number) => new Date(now - n * 60_000).toISOString();

export const DEMO_CASES = [
    {
        id: 'case-5001', title: 'Multiple SSH authentication failures — web-edge-01', severity: 'high', status: 'open',
        tier: 2, created_at: minsAgo(12), updated_at: minsAgo(10), assigned_to: 'Analyst (demo)', agent_name: 'web-edge-01',
        mitre: [{ id: 'T1110', tactic: 'Credential Access' }],
        timeline: [
            { at: minsAgo(12), text: 'Case opened automatically from alert 9001.' },
            { at: minsAgo(10), text: 'SOAR enrichment completed — source IP flagged on 2 public blocklists.' },
        ],
    },
    {
        id: 'case-5002', title: 'Suspicious WebLogic deserialization payload — app-weblogic-01', severity: 'critical', status: 'investigating',
        tier: 3, created_at: minsAgo(40), updated_at: minsAgo(15), assigned_to: 'Analyst (demo)', agent_name: 'app-weblogic-01',
        mitre: [{ id: 'T1190', tactic: 'Initial Access' }, { id: 'T1059', tactic: 'Execution' }],
        timeline: [
            { at: minsAgo(40), text: 'Case opened automatically from alert 9002.' },
            { at: minsAgo(35), text: 'Block-source-IP request submitted for approval.' },
            { at: minsAgo(15), text: 'soc_manager approved IP block; perimeter firewall updated.' },
        ],
    },
    {
        id: 'case-5003', title: 'Outbound connection to known malicious IP — cloud-vpc-prod', severity: 'critical', status: 'open',
        tier: 2, created_at: minsAgo(5), updated_at: minsAgo(5), assigned_to: null, agent_name: 'cloud-vpc-prod',
        mitre: [{ id: 'T1071', tactic: 'Command and Control' }],
        timeline: [{ at: minsAgo(5), text: 'Case opened automatically from alert 9005 — ThreatFox indicator match.' }],
    },
    {
        id: 'case-4987', title: 'Unsupported Windows 10 build flagged by vulnerability scan', severity: 'medium', status: 'closed',
        tier: 1, created_at: minsAgo(60 * 24 * 5), updated_at: minsAgo(60 * 24 * 3), assigned_to: 'Analyst (demo)', agent_name: 'legacy-ws-archive',
        mitre: [],
        timeline: [
            { at: minsAgo(60 * 24 * 5), text: 'Case opened from VMS finding find-006.' },
            { at: minsAgo(60 * 24 * 3), text: 'Remediation plan accepted; case closed pending hardware refresh.' },
        ],
    },
];

// Computed on every call from the live case list: case status changes (PATCH, escalate) must be
// reflected in the summary the same request returns, never a snapshot taken at module load.
export function casesSummary() {
    const open = DEMO_CASES.filter((c) => c.status === 'open').length;
    const investigating = DEMO_CASES.filter((c) => c.status === 'investigating').length;
    return {
        total: DEMO_CASES.length,
        open,
        investigating,
        closed: DEMO_CASES.filter((c) => c.status === 'closed').length,
        active: open + investigating,
        critical: DEMO_CASES.filter((c) => c.status !== 'closed' && c.severity === 'critical').length,
    };
}

export const DEMO_PLAYBOOKS = [
    { id: 'pb-1', name: 'Credential stuffing response', tier: 1, steps: 3 },
    { id: 'pb-2', name: 'Web application compromise', tier: 3, steps: 6 },
    { id: 'pb-3', name: 'C2 beacon containment', tier: 3, steps: 5 },
];

export const DEMO_APPROVALS = [
    { id: 'appr-1', case_id: 'case-5002', action: 'block_ip', target: '45.155.205.90', status: 'approved', requested_at: minsAgo(35), decided_at: minsAgo(15), decided_by: 'soc_manager (demo)' },
    { id: 'appr-2', case_id: 'case-5003', action: 'isolate_agent', target: 'cloud-vpc-prod', status: 'pending', requested_at: minsAgo(4), decided_at: null, decided_by: null },
];
