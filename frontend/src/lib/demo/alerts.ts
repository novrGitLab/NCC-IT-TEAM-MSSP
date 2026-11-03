// NCC IT — ILLUSTRATIVE FIXTURE. Shaped to match StoredAlert / AlertStats
// (src/lib/alerts.ts) so the retained SecOps alert pages render unmodified. Typed (not `as const`)
// so an acknowledge/escalate button can mutate `status`/`case_id` in place for a real local effect
// instead of a response that claims success while nothing changed.
import type { StoredAlert } from '@/lib/alerts';

const now = Date.now();
const minsAgo = (n: number) => new Date(now - n * 60_000).toISOString();

export const DEMO_ALERTS: StoredAlert[] = [
    { id: 'alert-9001', wazuh_alert_id: '9001', rule_id: '5710', rule_level: 10, rule_description: 'Multiple SSH authentication failures', agent_id: '001', agent_name: 'web-edge-01', agent_ip: '10.20.1.11', severity: 'high', mitre_ids: ['T1110'], wazuh_groups: ['ssh', 'authentication_failed'], location: '/var/log/auth.log', raw_truncated: false, event_time: minsAgo(12), received_at: minsAgo(12), status: 'new', case_id: 'case-5001', src_ip: '185.220.101.47', src_port: 51422, dst_ip: '10.20.1.11', dst_port: 22, protocol: 'tcp', net_action: null, net_direction: 'inbound', net_interface: 'eth0', decoder_name: 'sshd', device_hostname: 'web-edge-01' },
    { id: 'alert-9002', wazuh_alert_id: '9002', rule_id: '100210', rule_level: 12, rule_description: 'Suspicious WebLogic deserialization payload observed', agent_id: '003', agent_name: 'app-weblogic-01', agent_ip: '10.20.2.21', severity: 'critical', mitre_ids: ['T1190', 'T1059'], wazuh_groups: ['web', 'attack'], location: '/opt/weblogic/logs/access.log', raw_truncated: false, event_time: minsAgo(40), received_at: minsAgo(40), status: 'escalated', case_id: 'case-5002', src_ip: '45.155.205.90', src_port: 443, dst_ip: '10.20.2.21', dst_port: 7001, protocol: 'tcp', net_action: null, net_direction: 'inbound', net_interface: 'eth0', decoder_name: 'weblogic', device_hostname: 'app-weblogic-01' },
    { id: 'alert-9003', wazuh_alert_id: '9003', rule_id: '31151', rule_level: 7, rule_description: 'Web attack: SQL injection attempt', agent_id: '001', agent_name: 'web-edge-01', agent_ip: '10.20.1.11', severity: 'medium', mitre_ids: ['T1190'], wazuh_groups: ['web', 'sqli'], location: '/var/log/nginx/access.log', raw_truncated: false, event_time: minsAgo(90), received_at: minsAgo(90), status: 'triaged', case_id: null, src_ip: '103.21.244.12', src_port: 8080, dst_ip: '10.20.1.11', dst_port: 443, protocol: 'tcp', net_action: null, net_direction: 'inbound', net_interface: 'eth0', decoder_name: 'nginx', device_hostname: 'web-edge-01' },
    { id: 'alert-9004', wazuh_alert_id: '9004', rule_id: '5402', rule_level: 6, rule_description: 'Successful sudo to ROOT executed', agent_id: '013', agent_name: 'dev-ide-sandbox-01', agent_ip: '10.20.20.5', severity: 'low', mitre_ids: ['T1548'], wazuh_groups: ['authentication_success'], location: '/var/log/auth.log', raw_truncated: false, event_time: minsAgo(140), received_at: minsAgo(140), status: 'closed', case_id: null, src_ip: null, src_port: null, dst_ip: null, dst_port: null, protocol: null, net_action: null, net_direction: null, net_interface: null, decoder_name: 'sudo', device_hostname: 'dev-ide-sandbox-01' },
    { id: 'alert-9005', wazuh_alert_id: '9005', rule_id: '100300', rule_level: 13, rule_description: 'Outbound connection to known malicious IP (ThreatFox match)', agent_id: '007', agent_name: 'cloud-vpc-prod', agent_ip: '—', severity: 'critical', mitre_ids: ['T1071', 'T1041'], wazuh_groups: ['intel_match'], location: 'vpc-flow-logs', raw_truncated: false, event_time: minsAgo(5), received_at: minsAgo(5), status: 'new', case_id: 'case-5003', src_ip: '10.20.2.1', src_port: 51822, dst_ip: '193.106.191.202', dst_port: 443, protocol: 'tcp', net_action: 'pass', net_direction: 'outbound', net_interface: 'eth0', decoder_name: 'vpc-flow', device_hostname: 'cloud-vpc-prod' },
    { id: 'alert-9006', wazuh_alert_id: '9006', rule_id: '18107', rule_level: 9, rule_description: 'Firewall rule violation: inbound port scan detected', agent_id: '009', agent_name: 'fw-perimeter-01', agent_ip: '10.20.0.1', severity: 'high', mitre_ids: ['T1595'], wazuh_groups: ['firewall'], location: 'opnsense-filter', raw_truncated: false, event_time: minsAgo(210), received_at: minsAgo(210), status: 'triaged', case_id: null, src_ip: '194.26.29.14', src_port: null, dst_ip: '10.20.0.1', dst_port: null, protocol: 'tcp', net_action: 'block', net_direction: 'inbound', net_interface: 'wan0', decoder_name: 'opnsense', device_hostname: 'fw-perimeter-01' },
    { id: 'alert-9007', wazuh_alert_id: '9007', rule_id: '2501', rule_level: 5, rule_description: 'Windows Defender signature update failed', agent_id: '011', agent_name: 'ws-finance-07', agent_ip: '10.20.10.44', severity: 'low', mitre_ids: [], wazuh_groups: ['windows', 'defender'], location: 'Microsoft-Windows-Windows Defender', raw_truncated: false, event_time: minsAgo(300), received_at: minsAgo(300), status: 'false_positive', case_id: null, src_ip: null, src_port: null, dst_ip: null, dst_port: null, protocol: null, net_action: null, net_direction: null, net_interface: null, decoder_name: 'windows-defender', device_hostname: 'ws-finance-07' },
];

export const byAlertId = (id: string) => DEMO_ALERTS.find((a) => a.id === id) ?? null;
export function patchAlert(id: string, changes: { status?: StoredAlert['status']; case_id?: string | null }) {
    const a = byAlertId(id);
    if (!a) return null;
    if (changes.status !== undefined) a.status = changes.status;
    if (changes.case_id !== undefined) a.case_id = changes.case_id;
    return a;
}

// Computed on every call from the live alert list, so triage and escalation changes show up in the
// same response that reports them.
export function alertStats() {
    const count = <K extends string>(keys: readonly K[], pick: (a: StoredAlert) => string) =>
        Object.fromEntries(keys.map((k) => [k, DEMO_ALERTS.filter((a) => pick(a) === k).length])) as Record<K, number>;
    return {
        range: '24h',
        since: minsAgo(24 * 60),
        total: DEMO_ALERTS.length,
        by_severity: count(['critical', 'high', 'medium', 'low', 'info'] as const, (a) => a.severity),
        by_status: count(['new', 'triaged', 'escalated', 'closed', 'false_positive'] as const, (a) => a.status),
        last_received_at: DEMO_ALERTS[0].received_at,
        last_event_time: DEMO_ALERTS[0].event_time,
        stale_after_minutes: 60,
    };
}
