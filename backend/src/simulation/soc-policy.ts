// Deterministic SOC triage policy. Pure functions over an alert group and an explicit clock value,
// so every automatic transition is reproducible and testable. AI never sets these decisions: it may
// suggest correlations or severity changes, but these rules are authoritative.
//
// Terms used below:
//   continuous activity — consecutive events whose gaps are each at most INACTIVITY_MS. A gap longer
//                         than that ends the run; the longest run is measured.
//   quiet period        — time since the most recent related event.

export const POLICY_VERSION = '2026-11-v1';
export const MINUTE_MS = 60_000;
export const INACTIVITY_MS = 30 * MINUTE_MS;
export const QUIET_CLOSE_MS = 30 * MINUTE_MS;
export const CONTINUOUS_ESCALATE_MS = 2 * 60 * MINUTE_MS;
export const HIGH_WINDOW_MS = 60 * MINUTE_MS;
export const HIGH_ESCALATE_COUNT = 5;

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AlertEvent { at: number; severity: AlertSeverity; rule: string; asset_id: string; identity: string | null }

export interface AlertGroup {
    key: string;
    events: AlertEvent[];
    /** Unresolved high-confidence compromise indicator on this group (e.g. confirmed malicious IP, unresolved critical finding). */
    unresolved_compromise_indicator: boolean;
    /** An existing security case already correlated with this group, if any. */
    existing_case_id: string | null;
    /** Whether a critical-severity case is correlated with this group (any linked case that is critical). */
    critical_case_correlated: boolean;
}

export type Decision =
    | { action: 'monitor'; reason: string }
    | { action: 'auto_close'; reason: string }
    | { action: 'create_case'; reason: string }
    | { action: 'attach_case'; case_id: string; reason: string }
    | { action: 'escalate_case'; reason: string };

export interface PolicyDecision {
    decision: Decision;
    evidence: { event_count: number; longest_continuous_ms: number; quiet_ms: number; window_ends_at: number | null; highest_severity: AlertSeverity };
    policy_version: string;
    decided_at: number;
    /** Audit entry shape, ready to persist. */
    audit: { at: number; actor: 'policy'; action: 'soc_policy.decision'; details: { group: string; action: string; reason: string; policy_version: string } };
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function groupKey(event: AlertEvent): string {
    return `${event.rule}|${event.asset_id}|${event.identity ?? '-'}`;
}

/** Longest run of events in which each consecutive gap is at most the inactivity threshold. */
export function longestContinuousMs(times: number[], inactivityMs = INACTIVITY_MS): number {
    if (times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    let best = 0;
    let runStart = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > inactivityMs) runStart = sorted[i];
        best = Math.max(best, sorted[i] - runStart);
    }
    return best;
}

function highestSeverity(events: AlertEvent[]): AlertSeverity {
    return events.reduce<AlertSeverity>((max, e) => (SEVERITY_RANK[e.severity] > SEVERITY_RANK[max] ? e.severity : max), 'info');
}

function wrap(decision: Decision, evidence: PolicyDecision['evidence'], group: AlertGroup, now: number): PolicyDecision {
    return {
        decision, evidence, policy_version: POLICY_VERSION, decided_at: now,
        audit: { at: now, actor: 'policy', action: 'soc_policy.decision', details: { group: group.key, action: decision.action, reason: decision.reason, policy_version: POLICY_VERSION } },
    };
}

/** Evaluates one alert group at clock value `now`. Pure: the same inputs always give the same output. */
export function evaluateGroup(group: AlertGroup, now: number): PolicyDecision {
    const times = group.events.map((e) => e.at);
    const first = times.length ? Math.min(...times) : now;
    const last = times.length ? Math.max(...times) : now;
    const severity = highestSeverity(group.events);
    const continuous = longestContinuousMs(times);
    const quiet = now - last;
    const evidence = (windowEnd: number | null): PolicyDecision['evidence'] => ({
        event_count: group.events.length, longest_continuous_ms: continuous, quiet_ms: quiet, window_ends_at: windowEnd, highest_severity: severity,
    });

    // Critical: always a case, never automatically closed. Repeats attach to the existing case.
    if (severity === 'critical') {
        if (group.existing_case_id) return wrap({ action: 'attach_case', case_id: group.existing_case_id, reason: 'Critical alert attached to the existing case for the same incident (no duplicate case).' }, evidence(null), group, now);
        return wrap({ action: 'create_case', reason: 'Critical alert: a security case is created immediately and must be assigned to an analyst.' }, evidence(null), group, now);
    }

    // High: observe a full 60-minute window from the first event, then decide.
    if (severity === 'high') {
        const windowEnd = first + HIGH_WINDOW_MS;
        if (group.existing_case_id) return wrap({ action: 'attach_case', case_id: group.existing_case_id, reason: 'High alert attached to the existing case for the same incident.' }, evidence(windowEnd), group, now);
        const withinWindow = group.events.filter((e) => e.at <= windowEnd).length;
        if (withinWindow >= HIGH_ESCALATE_COUNT) return wrap({ action: 'escalate_case', reason: `${withinWindow} related high alerts within one hour: escalated to a security case.` }, evidence(windowEnd), group, now);
        if (now < windowEnd) return wrap({ action: 'monitor', reason: 'High alert under observation until the 60-minute window ends.' }, evidence(windowEnd), group, now);
        if (group.unresolved_compromise_indicator) return wrap({ action: 'escalate_case', reason: 'Unresolved high-confidence compromise indicator: not closed automatically, escalated to a case.' }, evidence(windowEnd), group, now);
        if (group.critical_case_correlated) return wrap({ action: 'escalate_case', reason: 'Correlated with an open critical case: escalated, not closed.' }, evidence(windowEnd), group, now);
        return wrap({ action: 'auto_close', reason: `Window ended with ${group.events.length} related alert(s) (fewer than ${HIGH_ESCALATE_COUNT}) and no compromise indicator or critical correlation.` }, evidence(windowEnd), group, now);
    }

    // Low / medium / info.
    if (group.unresolved_compromise_indicator) return wrap({ action: 'escalate_case', reason: 'Unresolved compromise indicator: not closed automatically, escalated to a case.' }, evidence(null), group, now);
    if (continuous >= CONTINUOUS_ESCALATE_MS) return wrap({ action: 'escalate_case', reason: 'Related activity continued for 2 hours without a gap longer than 30 minutes: escalated to a security case.' }, evidence(null), group, now);
    if (quiet >= QUIET_CLOSE_MS) return wrap({ action: 'auto_close', reason: 'No related alert for 30 minutes: the group is closed automatically.' }, evidence(null), group, now);
    return wrap({ action: 'monitor', reason: 'New or recently active alert group under monitoring.' }, evidence(null), group, now);
}
