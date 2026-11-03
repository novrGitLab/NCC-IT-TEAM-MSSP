// NCC IT — ILLUSTRATIVE FIXTURE. Collector/worker/onboarding walkthrough sample data.
// No real collector is ever installed, executed or connected — every status below is simulated.
const now = Date.now();
const minsAgo = (n: number) => new Date(now - n * 60_000).toISOString();

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
