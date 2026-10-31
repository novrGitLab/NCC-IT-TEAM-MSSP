// NovaSOC NCC — DEMONSTRATION FIXTURE. Sample reporting/insights data.
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

export const DEMO_WEEKLY_INSIGHTS = {
    week_of: daysAgo(7),
    alerts_total: 312,
    cases_opened: 9,
    cases_closed: 6,
    mean_time_to_triage_minutes: 18,
    top_mitre_tactics: ['Credential Access', 'Initial Access', 'Command and Control'],
    vulnerabilities_remediated: 5,
};

export const DEMO_REPORTS = [
    { id: 'report-1', title: 'Weekly Security Summary', kind: 'security', period: 'Last 7 days', generated_at: daysAgo(1) },
    { id: 'report-2', title: 'Vulnerability Management Report', kind: 'vulnerability', period: 'Last 30 days', generated_at: daysAgo(3) },
    { id: 'report-3', title: 'Incident Response Summary', kind: 'incident', period: 'Last quarter', generated_at: daysAgo(10) },
];
