// NovaSOC NCC — DEMONSTRATION FIXTURE. Shaped to match the real `VmsAsset`/`VmsService`/`VmsTech`/
// `VmsEvent` interfaces in `@/lib/vms` exactly, so the existing Asset Inventory / Asset Detail pages
// render without any component changes. Not real asset data — coherent sample data only.
import type { VmsAsset, VmsService, VmsTech, VmsEvent } from '@/lib/vms';

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

export const DEMO_ASSETS: VmsAsset[] = [
    { id: 'asset-001', asset_type: 'domain', value: 'web-edge-01.novasoc-ncc.demo', hostnames: ['web-edge-01.novasoc-ncc.demo'], ips: ['10.20.1.11'], dns: { a: ['10.20.1.11'] }, http: { url: 'https://web-edge-01.novasoc-ncc.demo', status: 200, title: 'NovaSOC NCC — Edge', webserver: 'nginx', cdn: null }, exposure: 'internet', alive: true, owner: 'Platform Team', criticality: 'critical', wazuh_agent_id: null, discovery_sources: ['discovery', 'passive_osint'], first_seen: daysAgo(120), last_seen: daysAgo(0), status: 'active', os: 'Ubuntu 22.04' },
    { id: 'asset-002', asset_type: 'domain', value: 'web-edge-02.novasoc-ncc.demo', hostnames: ['web-edge-02.novasoc-ncc.demo'], ips: ['10.20.1.12'], dns: { a: ['10.20.1.12'] }, http: { url: 'https://web-edge-02.novasoc-ncc.demo', status: 200, title: 'NovaSOC NCC — Edge', webserver: 'nginx', cdn: null }, exposure: 'internet', alive: true, owner: 'Platform Team', criticality: 'critical', wazuh_agent_id: null, discovery_sources: ['discovery'], first_seen: daysAgo(120), last_seen: daysAgo(0), status: 'active', os: 'Ubuntu 22.04' },
    { id: 'asset-003', asset_type: 'host', value: 'app-weblogic-01.internal', hostnames: ['app-weblogic-01.internal'], ips: ['10.20.2.21'], dns: {}, http: { url: 'http://app-weblogic-01.internal:7001', status: 200, title: 'Oracle WebLogic Server', webserver: 'weblogic', cdn: null }, exposure: 'internal', alive: true, owner: 'Middleware Team', criticality: 'high', wazuh_agent_id: 'wz-agent-003', discovery_sources: ['ports'], first_seen: daysAgo(200), last_seen: daysAgo(1), status: 'active', os: 'Oracle Linux 8', agent_status: 'active', agent_last_keepalive: daysAgo(0), agent_groups: ['middleware'] },
    { id: 'asset-004', asset_type: 'host', value: 'app-weblogic-02.internal', hostnames: ['app-weblogic-02.internal'], ips: ['10.20.2.22'], dns: {}, http: { url: 'http://app-weblogic-02.internal:7001', status: 200, title: 'Oracle WebLogic Server', webserver: 'weblogic', cdn: null }, exposure: 'internal', alive: true, owner: 'Middleware Team', criticality: 'high', wazuh_agent_id: 'wz-agent-004', discovery_sources: ['ports'], first_seen: daysAgo(200), last_seen: daysAgo(1), status: 'active', os: 'Oracle Linux 8', agent_status: 'active', agent_last_keepalive: daysAgo(0), agent_groups: ['middleware'] },
    { id: 'asset-005', asset_type: 'host', value: 'db-primary-01.internal', hostnames: ['db-primary-01.internal'], ips: ['10.20.3.10'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Database Team', criticality: 'critical', wazuh_agent_id: 'wz-agent-005', discovery_sources: ['ports'], first_seen: daysAgo(300), last_seen: daysAgo(0), status: 'active', os: 'RHEL 9', agent_status: 'active', agent_last_keepalive: daysAgo(0), agent_groups: ['database'] },
    { id: 'asset-006', asset_type: 'host', value: 'db-replica-01.internal', hostnames: ['db-replica-01.internal'], ips: ['10.20.3.11'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Database Team', criticality: 'high', wazuh_agent_id: 'wz-agent-006', discovery_sources: ['ports'], first_seen: daysAgo(300), last_seen: daysAgo(2), status: 'active', os: 'RHEL 9', agent_status: 'active', agent_last_keepalive: daysAgo(2), agent_groups: ['database'] },
    { id: 'asset-007', asset_type: 'ip', value: '10.20.5.7', hostnames: [], ips: ['10.20.5.7'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Cloud Team', criticality: 'high', wazuh_agent_id: null, discovery_sources: ['discovery'], first_seen: daysAgo(90), last_seen: daysAgo(0), status: 'active', os: 'AWS VPC (prod)' },
    { id: 'asset-008', asset_type: 'domain', value: 'reports-bucket.novasoc-ncc.demo', hostnames: ['reports-bucket.novasoc-ncc.demo'], ips: [], dns: { cname: ['s3.amazonaws.com'] }, http: { url: 'https://reports-bucket.novasoc-ncc.demo', status: 403, title: null, webserver: 'AmazonS3', cdn: null }, exposure: 'internet', alive: true, owner: 'Cloud Team', criticality: 'medium', wazuh_agent_id: null, discovery_sources: ['discovery', 'passive_osint'], first_seen: daysAgo(60), last_seen: daysAgo(0), status: 'active', os: 'AWS S3' },
    { id: 'asset-009', asset_type: 'ip', value: '41.58.12.1', hostnames: [], ips: ['41.58.12.1'], dns: {}, http: null, exposure: 'internet', alive: true, owner: 'Network Team', criticality: 'critical', wazuh_agent_id: null, discovery_sources: ['discovery'], first_seen: daysAgo(365), last_seen: daysAgo(0), status: 'active', os: 'OPNsense 24.x' },
    { id: 'asset-010', asset_type: 'ip', value: '10.20.0.2', hostnames: [], ips: ['10.20.0.2'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Network Team', criticality: 'high', wazuh_agent_id: null, discovery_sources: ['discovery'], first_seen: daysAgo(365), last_seen: daysAgo(3), status: 'active', os: 'Cisco IOS-XE' },
    { id: 'asset-011', asset_type: 'endpoint', value: 'ws-finance-07', hostnames: ['ws-finance-07.internal'], ips: ['10.20.10.44'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Finance Dept', criticality: 'medium', wazuh_agent_id: 'wz-agent-011', discovery_sources: ['ports'], first_seen: daysAgo(80), last_seen: daysAgo(1), status: 'active', os: 'Windows 11', agent_status: 'active', agent_last_keepalive: daysAgo(1), agent_groups: ['workstations', 'finance'] },
    { id: 'asset-012', asset_type: 'endpoint', value: 'ws-finance-12', hostnames: ['ws-finance-12.internal'], ips: ['10.20.10.49'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Finance Dept', criticality: 'medium', wazuh_agent_id: 'wz-agent-012', discovery_sources: ['ports'], first_seen: daysAgo(80), last_seen: daysAgo(5), status: 'active', os: 'Windows 11', agent_status: 'active', agent_last_keepalive: daysAgo(5), agent_groups: ['workstations', 'finance'] },
    { id: 'asset-013', asset_type: 'endpoint', value: 'dev-ide-sandbox-01', hostnames: ['dev-ide-sandbox-01.internal'], ips: ['10.20.20.5'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Engineering', criticality: 'low', wazuh_agent_id: 'wz-agent-013', discovery_sources: ['ports'], first_seen: daysAgo(40), last_seen: daysAgo(0), status: 'active', os: 'Ubuntu 22.04', agent_status: 'active', agent_last_keepalive: daysAgo(0), agent_groups: ['workstations', 'engineering'] },
    { id: 'asset-014', asset_type: 'endpoint', value: 'dev-ide-sandbox-02', hostnames: ['dev-ide-sandbox-02.internal'], ips: ['10.20.20.6'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Engineering', criticality: 'low', wazuh_agent_id: 'wz-agent-014', discovery_sources: ['ports'], first_seen: daysAgo(40), last_seen: daysAgo(0), status: 'active', os: 'macOS 15', agent_status: 'active', agent_last_keepalive: daysAgo(0), agent_groups: ['workstations', 'engineering'] },
    { id: 'asset-015', asset_type: 'domain', value: 'mail-gateway-01.novasoc-ncc.demo', hostnames: ['mail-gateway-01.novasoc-ncc.demo'], ips: ['10.20.4.5'], dns: { a: ['10.20.4.5'] }, http: null, exposure: 'internet', alive: true, owner: 'Platform Team', criticality: 'high', wazuh_agent_id: 'wz-agent-015', discovery_sources: ['discovery', 'ports'], first_seen: daysAgo(150), last_seen: daysAgo(0), status: 'active', os: 'Ubuntu 22.04', agent_status: 'active', agent_last_keepalive: daysAgo(0), agent_groups: ['platform'] },
    { id: 'asset-016', asset_type: 'endpoint', value: 'legacy-ws-archive', hostnames: ['legacy-ws-archive.internal'], ips: ['10.20.10.90'], dns: {}, http: null, exposure: 'internal', alive: false, owner: 'Finance Dept', criticality: 'low', wazuh_agent_id: 'wz-agent-016', discovery_sources: ['ports'], first_seen: daysAgo(500), last_seen: daysAgo(45), status: 'gone', os: 'Windows 10', agent_status: 'disconnected', agent_last_keepalive: daysAgo(45), agent_groups: ['workstations', 'finance'] },
    { id: 'asset-017', asset_type: 'ip', value: '10.20.6.30', hostnames: [], ips: ['10.20.6.30'], dns: {}, http: null, exposure: 'internal', alive: true, owner: 'Cloud Team', criticality: 'medium', wazuh_agent_id: null, discovery_sources: ['discovery'], first_seen: daysAgo(70), last_seen: daysAgo(0), status: 'active', os: 'AWS Lambda (ingest)' },
    { id: 'asset-018', asset_type: 'ip', value: '10.20.0.3', hostnames: [], ips: ['10.20.0.3'], dns: {}, http: null, exposure: 'internet', alive: true, owner: 'Network Team', criticality: 'high', wazuh_agent_id: null, discovery_sources: ['discovery'], first_seen: daysAgo(365), last_seen: daysAgo(2), status: 'active', os: 'Cisco IOS-XE (DMZ)' },
];

export const byAssetId = (id: string | null) => DEMO_ASSETS.find((a) => a.id === id) ?? null;

export const DEMO_ASSETS_TOTAL = DEMO_ASSETS.length;
export const DEMO_ASSETS_ACTIVE = DEMO_ASSETS.filter((a) => a.status === 'active').length;
export const DEMO_ASSETS_INTERNET = DEMO_ASSETS.filter((a) => a.exposure === 'internet').length;
export const DEMO_ASSETS_GONE = DEMO_ASSETS.filter((a) => a.status === 'gone').length;

export const DEMO_SERVICES_BY_ASSET: Record<string, VmsService[]> = {
    'asset-001': [{ id: 'svc-001a', port: 443, protocol: 'tcp', service: 'https', product: 'nginx', version: '1.25', source: 'ports', first_seen: daysAgo(100), last_seen: daysAgo(0), status: 'open' }],
    'asset-003': [{ id: 'svc-003a', port: 7001, protocol: 'tcp', service: 'http', product: 'WebLogic Server', version: '12.2.1.4', source: 'ports', first_seen: daysAgo(180), last_seen: daysAgo(1), status: 'open' }],
    'asset-005': [{ id: 'svc-005a', port: 5432, protocol: 'tcp', service: 'postgresql', product: 'PostgreSQL', version: '15.4', source: 'ports', first_seen: daysAgo(280), last_seen: daysAgo(0), status: 'open' }],
};

export const DEMO_TECH_BY_ASSET: Record<string, VmsTech[]> = {
    'asset-001': [{ id: 'tech-001a', name: 'nginx', version: '1.25.2', source: 'http', first_seen: daysAgo(100), last_seen: daysAgo(0) }],
    'asset-003': [{ id: 'tech-003a', name: 'Oracle WebLogic Server', version: '12.2.1.4', source: 'http', first_seen: daysAgo(180), last_seen: daysAgo(1) }],
};

export const DEMO_EVENTS_BY_ASSET: Record<string, VmsEvent[]> = Object.fromEntries(
    DEMO_ASSETS.map((a) => [a.id, [{ id: `evt-${a.id}`, at: a.last_seen, event: 'asset_changed', details: { field: 'last_seen' }, asset_id: a.id }] as VmsEvent[]]),
);

export const DEMO_EVENTS: VmsEvent[] = DEMO_ASSETS.slice(0, 8).map((a, i) => ({
    id: `evt-feed-${i}`, at: daysAgo(i), event: i % 2 === 0 ? 'service_new' : 'asset_changed',
    details: i % 2 === 0 ? { port: 443, protocol: 'tcp', service: 'https' } : { field: 'last_seen' },
    asset_id: a.id, vms_assets: { value: a.value, asset_type: a.asset_type, exposure: a.exposure },
}));
