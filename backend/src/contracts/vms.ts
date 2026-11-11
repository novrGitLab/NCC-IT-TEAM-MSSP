// VMS domain types shared by the backend simulation and the frontend screens. Declarations only.

export interface VmsScope {
    id: string; kind: 'domain' | 'ip' | 'cidr'; value: string; include_subdomains: boolean; allow_port_scan: boolean; allow_vuln_scan: boolean;
    authorization_reference: string; notes: string | null; status: 'active' | 'revoked'; approved_by: string; approved_at: string; expires_at: string;
    /** Hosts, .subdomains, IPs or CIDRs never touched (P13). */
    exclusions?: string[];
    /** false = passive-only scope (P15): no active discovery. Absent before that SQL. */
    allow_discovery?: boolean;
    revoked_by: string | null; revoked_at: string | null;
}
export interface VmsScan {
    id: string; scope_id: string; kind: 'passive_osint' | 'discovery' | 'ports' | 'vuln_nuclei' | 'vuln_openvas'; targets: string[]; options: { ports?: string };
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; requested_by: string; requested_at: string; started_at: string | null; finished_at: string | null;
    progress: { phase?: string; done?: number; total?: number; message?: string }; error: string | null; summary: Record<string, unknown> | null;
    worker_id: string | null; heartbeat_at: string | null; cancel_requested: boolean; purpose?: string;
    /** Why a queued scan cannot run as things stand (P12); null when nothing stands in its way. */
    attention?: string | null;
    /** Set for a scan targeted at one specific asset (e.g. the onboarding scenario's scan-on-demand) — absent for scope-wide scans. */
    target_asset_id?: string | null;
}
export interface VmsAsset {
    id: string; asset_type: 'domain' | 'host' | 'ip' | 'endpoint'; value: string; hostnames: string[]; ips: string[];
    dns: { a?: string[]; aaaa?: string[]; cname?: string[] }; http: { url?: string; status?: number | null; title?: string | null; webserver?: string | null; cdn?: string | null } | null;
    exposure: 'internet' | 'internal' | 'unknown'; alive: boolean | null; owner: string | null; criticality: 'low' | 'medium' | 'high' | 'critical';
    wazuh_agent_id: string | null; discovery_sources: string[]; first_seen: string; last_seen: string; status: 'active' | 'gone';
    /** What the last scan learned about reaching this host (P12; absent before that SQL). */
    last_assessment?: VmsReachAssessment | null; last_assessed_at?: string | null;
    /** Wazuh endpoints (P19; absent before that SQL): what the agent reports, eligibility, next scan. */
    os?: string | null; agent_status?: string | null; agent_last_keepalive?: string | null; agent_groups?: string[];
    scan_eligibility?: VmsEligibility | null; next_scan_at?: string | null;
    /** Organisation that owns this asset, when known (NCC collector discovery sets it). */
    org_id?: string | null;
    /** True for records produced by the platform's simulated collectors, never by a real scan. */
    simulated?: boolean;
    /** NCC critical infrastructure this asset represents (simulated collector discovery). */
    ncc?: { infrastructure_id: string; no: number; name: string; type: string; hosting: string; quantity: number | null } | null;
    /** Derived on read for simulated collector assets: who reports it and whether it is reporting now. */
    discovery?: { source: 'Simulated Collector'; collectors: { id: string; name: string; status: string }[]; health: 'reporting' | 'not_reporting' } | null;
}
export type AssessmentOutcome = 'reachable_open' | 'reachable_no_open' | 'unreachable' | 'no_route' | 'insufficient_evidence';
/** What one scan learned about reaching a host (P12). Not the Full Assessment (VmsAssessment, P13). */
export interface VmsReachAssessment {
    outcome: AssessmentOutcome; reason: string; method: 'nmap' | 'httpx';
    host_status?: string | null; host_status_reason?: string | null; port_states?: Record<string, number>; ports_scanned?: number; job_id?: string;
}
export interface VmsEvidence { id: string; target: string; tool: string; content: string; truncated: boolean; bytes: number; sha256: string; created_at: string; expires_at: string }
export interface VmsService { id: string; port: number; protocol: string; service: string | null; product: string | null; version: string | null; source: string; first_seen: string; last_seen: string; status: string }
export interface VmsTech { id: string; name: string; version: string; source: string; first_seen: string; last_seen: string }
export interface VmsEvent { id: string; at: string; event: string; details: Record<string, unknown>; asset_id: string | null; vms_assets?: { value: string; asset_type: string; exposure?: string } | null }
export type EligibilityStatus = 'eligible' | 'not_covered' | 'private_no_route' | 'offline' | 'no_address' | 'duplicate_address';
export interface VmsEligibility { status: EligibilityStatus; reason: string; target: string | null; scope_id: string | null; evaluated_at: string }
