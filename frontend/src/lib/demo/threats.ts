// NCC IT — ILLUSTRATIVE FIXTURE. Threat Intelligence sample data for the retained TI
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
    {
        id: 'actor-1', name: 'FIN-DEMO-12', aliases: ['FIN12-Shadow'], focus: 'global' as const, origin: 'Unknown (financially motivated)', motivation: 'Financial gain',
        targeted_sectors: ['Financial services', 'Telecommunications'], targeted_regions: ['Global'],
        techniques: [{ id: 'T1110', name: 'Brute Force' }, { id: 'T1071', name: 'Application Layer Protocol' }],
        description: 'A financially motivated cluster observed running credential-stuffing campaigns against internet-facing login services, then pivoting to internal systems once a foothold is gained.',
        damage: 'Reported credential theft and fraudulent transactions at targeted organisations; no confirmed link to this organisation\'s own environment.',
        known_incidents: [{ year: '2025', title: 'Credential-stuffing wave against regional banks', description: 'Public reporting described a multi-week campaign against online banking portals.', source: 'Industry ISAC advisory' }],
        reference: 'Industry ISAC profile', reference_url: 'https://www.cisa.gov/topics/cyber-threats-and-advisories', library_confidence: 'medium', last_active: daysAgo(3),
        source_mentions: { count: 2, nigeria_targeting: 0, last: daysAgo(1), reports: [{ id: 'rpt-1', title: 'Credential-stuffing indicators matched against perimeter logs', published_at: daysAgo(1) }, { id: 'rpt-2', title: 'Follow-up indicator sweep', published_at: daysAgo(6) }] },
    },
    {
        id: 'actor-2', name: 'APT-DEMO-77', aliases: ['Silent Orchid'], focus: 'global' as const, origin: 'Unknown (suspected state-nexus)', motivation: 'Espionage',
        targeted_sectors: ['Telecommunications', 'Critical infrastructure'], targeted_regions: ['Global'],
        techniques: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }, { id: 'T1059', name: 'Command and Scripting Interpreter' }],
        description: 'A long-running intrusion set known for exploiting unpatched public-facing applications and middleware to establish persistence.',
        damage: 'Publicly reported long-dwell-time intrusions at telecommunications and infrastructure operators; relevance here is advisory, not a confirmed detection.',
        known_incidents: [{ year: '2024', title: 'Middleware exploitation campaign', description: 'Public reporting linked exploitation of an unpatched middleware CVE to this cluster.', source: 'Vendor threat intelligence report' }],
        reference: 'Vendor threat intelligence report', reference_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', library_confidence: 'low', last_active: daysAgo(14),
        source_mentions: { count: 1, nigeria_targeting: 0, last: daysAgo(14), reports: [{ id: 'rpt-3', title: 'Exploitation pattern consistent with public reporting', published_at: daysAgo(14) }] },
    },
];

export const DEMO_TI_SOURCE_NAMED = [
    { name: 'Credential-Reaper', count: 3, last: daysAgo(2), nigeria: 0, reports: [{ id: 'rpt-4', title: 'Source-tagged credential harvesting activity', published_at: daysAgo(2) }] },
];

export const DEMO_TI_ACTOR_NOTES = [
    'Library profiles summarise public reporting and are not this platform\'s own attribution.',
    'Source-named entries reflect the tag a partner feed applied to its own report, not a verified identification.',
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
