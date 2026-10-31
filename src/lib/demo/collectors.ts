// NovaSOC NCC — DEMONSTRATION FIXTURE. Collector/worker/onboarding walkthrough sample data.
// No real collector is ever installed, executed or connected — every status below is simulated.
const now = Date.now();
const minsAgo = (n: number) => new Date(now - n * 60_000).toISOString();

export const DEMO_COLLECTORS = [
    { id: 'collector-1', name: 'demo-server-collector', asset_type: 'server', integration: 'Wazuh agent (simulated)', status: 'connected', last_heartbeat: minsAgo(1), telemetry_events_24h: 4820 },
    { id: 'collector-2', name: 'demo-weblogic-collector', asset_type: 'middleware', integration: 'Oracle WebLogic log shipper (simulated)', status: 'connected', last_heartbeat: minsAgo(2), telemetry_events_24h: 1140 },
    { id: 'collector-3', name: 'demo-cloud-collector', asset_type: 'cloud', integration: 'AWS CloudTrail forwarder (simulated)', status: 'connecting', last_heartbeat: minsAgo(14), telemetry_events_24h: 0 },
    { id: 'collector-4', name: 'demo-endpoint-collector', asset_type: 'workstation', integration: 'Endpoint agent (simulated)', status: 'connected', last_heartbeat: minsAgo(0), telemetry_events_24h: 2310 },
    { id: 'collector-5', name: 'demo-firewall-collector', asset_type: 'network', integration: 'Syslog forwarder (simulated)', status: 'disconnected', last_heartbeat: minsAgo(260), telemetry_events_24h: 0 },
];

export const DEMO_WORKER_STATUS = {
    workers: [
        { id: 'vms-worker-demo', kind: 'discovery,ports,vuln_nuclei', status: 'online', last_seen: minsAgo(1) },
    ],
};

export const DEMO_DEPLOYMENT_STEPS = [
    { step: 1, title: 'Choose asset or infrastructure type', description: 'Select server, middleware, cloud, endpoint or network.' },
    { step: 2, title: 'Select collector or integration type', description: 'Pick the simulated collector matching the asset type.' },
    { step: 3, title: 'View simulated deployment instructions', description: 'Example install/configuration steps (simulated — nothing is installed).' },
    { step: 4, title: 'View simulated connection verification', description: 'A simulated handshake confirms the collector would be reachable.' },
    { step: 5, title: 'See collector status', description: 'Connected / connecting / disconnected, as it would appear live.' },
    { step: 6, title: 'See example collected telemetry', description: 'Sample event volumes the collector would forward.' },
    { step: 7, title: 'See how collected data appears in asset inventory and monitoring', description: 'The asset and its findings/alerts as they would appear once connected.' },
];
