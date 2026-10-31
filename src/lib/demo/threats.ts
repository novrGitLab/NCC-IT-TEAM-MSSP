// NovaSOC NCC — DEMONSTRATION FIXTURE. Threat Intelligence sample data for the retained TI
// pages. TiFeed shape matches src/lib/ti.ts's TiFeed so TiSources.tsx renders unmodified.

const now = Date.now();
const hoursAgo = (n: number) => new Date(now - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

export const DEMO_TI_FEEDS = [
    { id: 'nvd', name: 'NVD / NIST CVE Database', configured: true, enabled: true, stale: false, failing: false, last_success_at: hoursAgo(2), last_run_at: hoursAgo(2), last_counts: { new: 14, updated: 32 }, last_error: null },
    { id: 'cisa_kev', name: 'CISA Known Exploited Vulnerabilities', configured: true, enabled: true, stale: false, failing: false, last_success_at: hoursAgo(6), last_run_at: hoursAgo(6), last_counts: { new: 3 }, last_error: null },
    { id: 'threatfox', name: 'ThreatFox', configured: true, enabled: true, stale: false, failing: false, last_success_at: hoursAgo(1), last_run_at: hoursAgo(1), last_counts: { new: 21 }, last_error: null },
    { id: 'urlhaus', name: 'URLhaus', configured: true, enabled: true, stale: false, failing: false, last_success_at: hoursAgo(1), last_run_at: hoursAgo(1), last_counts: { new: 9 }, last_error: null },
    { id: 'misp', name: 'MISP', configured: true, enabled: true, stale: true, failing: false, last_success_at: hoursAgo(26), last_run_at: hoursAgo(2), last_counts: null, last_error: 'Sync overdue — demo instance has no live MISP connection' },
    { id: 'mitre_attack', name: 'MITRE ATT&CK', configured: true, enabled: true, stale: false, failing: false, last_success_at: daysAgo(4), last_run_at: daysAgo(4), last_counts: null, last_error: null },
    { id: 'otx', name: 'AlienVault OTX', configured: false, enabled: false, stale: true, failing: false, last_success_at: null, last_run_at: null, last_counts: null, last_error: null },
    { id: 'virustotal', name: 'VirusTotal', configured: false, enabled: false, stale: true, failing: false, last_success_at: null, last_run_at: null, last_counts: null, last_error: null },
    { id: 'greynoise', name: 'GreyNoise', configured: false, enabled: false, stale: true, failing: false, last_success_at: null, last_run_at: null, last_counts: null, last_error: null },
];

export const DEMO_TI_SOURCES = { feeds: DEMO_TI_FEEDS };

export const DEMO_TI_OVERVIEW = {
    total_indicators: 1842,
    new_last_24h: 47,
    active_feeds: DEMO_TI_FEEDS.filter((f) => f.configured && f.enabled).length,
    total_feeds: DEMO_TI_FEEDS.length,
    top_tags: ['credential-access', 'c2', 'phishing', 'ransomware'],
};

export const DEMO_TI_ACTORS = [
    { id: 'actor-1', name: 'FIN-DEMO-12', confidence: 'medium', last_seen: daysAgo(3), techniques: ['T1110', 'T1071'] },
    { id: 'actor-2', name: 'APT-DEMO-77', confidence: 'low', last_seen: daysAgo(14), techniques: ['T1190', 'T1059'] },
];

export const DEMO_TI_MATCHES = [
    { id: 'match-1', indicator: '45.155.205.90', type: 'ip', status: 'new', matched_alert_id: 'alert-9002', first_seen: hoursAgo(1) },
    { id: 'match-2', indicator: '193.106.191.202', type: 'ip', status: 'new', matched_alert_id: 'alert-9005', first_seen: hoursAgo(0.1) },
];

export const DEMO_TI_MAP_POINTS = [
    { lat: 9.0765, lng: 7.3986, label: 'Abuja — inbound scan activity', weight: 3 },
    { lat: 6.5244, lng: 3.3792, label: 'Lagos — credential stuffing attempts', weight: 7 },
];

export const DEMO_TI_VULNERABILITIES = [
    { cve: 'CVE-2024-21216', cvss: 9.8, kev: true, affected_assets: 1, published: daysAgo(40) },
    { cve: 'CVE-2025-30123', cvss: 6.5, kev: false, affected_assets: 1, published: daysAgo(20) },
    { cve: 'CVE-2017-0144', cvss: 5.9, kev: true, affected_assets: 1, published: daysAgo(900) },
];
