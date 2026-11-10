// Endpoint collector package targets. A target is listed here so the platform knows which packages it
// would offer. Nothing is offered until an approved artifact exists in backend/artifacts/agents/ with a
// manifest.json whose SHA-256 values match the files (see simulation/agent-packages.ts).
// Browser-safe.

export interface AgentPackageTarget {
    id: string;
    name: string;
    os: 'windows' | 'linux' | 'macos';
    arch: 'x64' | 'arm64';
    /** File name the approved artifact must have. */
    file: string;
}

export const AGENT_PACKAGE_TARGETS: readonly AgentPackageTarget[] = [
    { id: 'endpoint-collector-windows-x64', name: 'Endpoint collector', os: 'windows', arch: 'x64', file: 'endpoint-collector-windows-x64.msi' },
    { id: 'endpoint-collector-linux-x64', name: 'Endpoint collector', os: 'linux', arch: 'x64', file: 'endpoint-collector-linux-x64.tar.gz' },
    { id: 'endpoint-collector-linux-arm64', name: 'Endpoint collector', os: 'linux', arch: 'arm64', file: 'endpoint-collector-linux-arm64.tar.gz' },
];
