// Demo fixture for the Nigeria National Threat Landscape map (GeneralDashboard ->
// NigeriaThreatMap). Real deployments source this from GreyNoise + Feodo Tracker + CIRCL,
// geolocated by IPregistry; none of that runs here. Summary totals are derived from the
// states array below with reduce(), not typed in separately, so they can't drift from it.

export interface DemoNigeriaState {
    name: string;
    code: string;
    region: string;
    threats: number;
    threatCount: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'clean';
    top_threat_type: string;
    top_rule: string;
    ips_monitored: number;
    latest_alert: string | null;
    threat_level: 'None' | 'Low' | 'Medium' | 'High' | 'Severe' | 'Critical';
    threatLevel: 'None' | 'Low' | 'Medium' | 'High' | 'Severe' | 'Critical';
}

export const DEMO_NIGERIA_STATES: DemoNigeriaState[] = [
    { name: 'Lagos', code: 'LA', region: 'South West', threats: 142, threatCount: 142, critical: 18, high: 40, medium: 60, low: 24, severity: 'critical', top_threat_type: 'Credential Theft', top_rule: 'SSH brute force', ips_monitored: 410, latest_alert: '2026-10-31T08:12:00Z', threat_level: 'Critical', threatLevel: 'Critical' },
    { name: 'FCT', code: 'FC', region: 'North Central', threats: 88, threatCount: 88, critical: 6, high: 30, medium: 35, low: 17, severity: 'high', top_threat_type: 'Phishing', top_rule: 'Lookalike domain registered', ips_monitored: 265, latest_alert: '2026-10-31T06:40:00Z', threat_level: 'High', threatLevel: 'High' },
    { name: 'Rivers', code: 'RI', region: 'South South', threats: 76, threatCount: 76, critical: 5, high: 28, medium: 30, low: 13, severity: 'high', top_threat_type: 'Malware', top_rule: 'Known botnet C2 contact', ips_monitored: 198, latest_alert: '2026-10-31T03:55:00Z', threat_level: 'High', threatLevel: 'High' },
    { name: 'Kano', code: 'KN', region: 'North West', threats: 41, threatCount: 41, critical: 1, high: 8, medium: 20, low: 12, severity: 'medium', top_threat_type: 'Port Scanning', top_rule: 'Mass scan burst', ips_monitored: 134, latest_alert: '2026-10-30T22:10:00Z', threat_level: 'Medium', threatLevel: 'Medium' },
    { name: 'Kaduna', code: 'KD', region: 'North West', threats: 35, threatCount: 35, critical: 0, high: 6, medium: 19, low: 10, severity: 'medium', top_threat_type: 'Brute Force', top_rule: 'RDP login flood', ips_monitored: 112, latest_alert: '2026-10-30T19:45:00Z', threat_level: 'Medium', threatLevel: 'Medium' },
    { name: 'Delta', code: 'DE', region: 'South South', threats: 22, threatCount: 22, critical: 0, high: 3, medium: 12, low: 7, severity: 'medium', top_threat_type: 'Suspicious DNS', top_rule: 'DGA-pattern lookup', ips_monitored: 74, latest_alert: '2026-10-30T14:05:00Z', threat_level: 'Medium', threatLevel: 'Medium' },
    { name: 'Borno', code: 'BO', region: 'North East', threats: 29, threatCount: 29, critical: 0, high: 4, medium: 15, low: 10, severity: 'medium', top_threat_type: 'Suspicious DNS', top_rule: 'DGA-pattern lookup', ips_monitored: 58, latest_alert: '2026-10-30T11:30:00Z', threat_level: 'Medium', threatLevel: 'Medium' },
    { name: 'Oyo', code: 'OY', region: 'South West', threats: 18, threatCount: 18, critical: 0, high: 1, medium: 7, low: 10, severity: 'low', top_threat_type: 'Port Scanning', top_rule: 'Single-IP probe', ips_monitored: 61, latest_alert: '2026-10-29T20:15:00Z', threat_level: 'Low', threatLevel: 'Low' },
    { name: 'Enugu', code: 'EN', region: 'South East', threats: 12, threatCount: 12, critical: 0, high: 0, medium: 5, low: 7, severity: 'low', top_threat_type: 'Port Scanning', top_rule: 'Single-IP probe', ips_monitored: 44, latest_alert: '2026-10-29T15:50:00Z', threat_level: 'Low', threatLevel: 'Low' },
    { name: 'Plateau', code: 'PL', region: 'North Central', threats: 9, threatCount: 9, critical: 0, high: 0, medium: 3, low: 6, severity: 'low', top_threat_type: 'Port Scanning', top_rule: 'Single-IP probe', ips_monitored: 31, latest_alert: '2026-10-29T09:20:00Z', threat_level: 'Low', threatLevel: 'Low' },
];

export function getNigeriaThreatsResponse() {
    const states = DEMO_NIGERIA_STATES;
    const total_threats = states.reduce((sum, s) => sum + s.threats, 0);
    const critical_states = states.filter((s) => s.severity === 'critical').length;
    const states_affected = states.filter((s) => s.threats > 0).length;
    const top = states.reduce((max, s) => (s.threats > max.threats ? s : max), states[0]);
    const highest_attack_states = [...states]
        .sort((a, b) => b.threats - a.threats)
        .slice(0, 6)
        .map((s) => ({ name: s.name, count: s.threats, state: s.name, threat_type: s.top_threat_type }));

    return {
        states,
        summary: {
            total_threats,
            // Illustrative composite, not a separately-invented figure: scaled off the same total.
            threat_score: Math.min(100, Math.round(total_threats / 5)),
            critical_states,
            states_affected,
            top_state: top?.name ?? null,
            today_attacks: null,
            malware: states.filter((s) => s.top_threat_type === 'Malware').length > 0 ? 1 : 0,
            phishing: states.filter((s) => s.top_threat_type === 'Phishing').length > 0 ? 1 : 0,
            botnets: null,
            ransomware: null,
            ddos: null,
            credential_theft: states.filter((s) => s.top_threat_type === 'Credential Theft').length > 0 ? 1 : 0,
            highest_attack_states,
            threat_level: top?.threat_level === 'Critical' ? 'CRITICAL' as const
                : top?.threat_level === 'High' ? 'HIGH' as const
                : states_affected > 0 ? 'MEDIUM' as const : 'CLEAR' as const,
        },
        source: 'demo',
        demo_data: true,
        generated_at: new Date().toISOString(),
    };
}
