// NCC IT — deterministic asset-discovery templates used when a virtual collector reaches
// 'operational' for the first time (scheduler.ts). Same category always produces the same kind of
// fictional assets, so re-seeding reproduces identical results — no uncontrolled randomness.
import type { VmsAsset } from '../../contracts/vms';
import type { CollectorInfraCategory, CollectorRecord } from '../types';

interface AssetTemplate {
    assetType: VmsAsset['asset_type'];
    namePrefix: string;
    os: string;
    criticality: VmsAsset['criticality'];
    exposure: VmsAsset['exposure'];
}

const CATEGORY_TEMPLATES: Record<CollectorInfraCategory, AssetTemplate> = {
    servers: { assetType: 'host', namePrefix: 'srv-onb', os: 'Ubuntu 22.04', criticality: 'high', exposure: 'internal' },
    middleware: { assetType: 'host', namePrefix: 'weblogic-onb', os: 'Oracle Linux 8', criticality: 'high', exposure: 'internal' },
    cloud: { assetType: 'ip', namePrefix: 'cloud-onb', os: 'AWS VPC (onboarded)', criticality: 'medium', exposure: 'internal' },
    endpoints: { assetType: 'endpoint', namePrefix: 'ws-onb', os: 'Windows 11', criticality: 'medium', exposure: 'internal' },
    dev_workstations: { assetType: 'endpoint', namePrefix: 'dev-ide-onb', os: 'Ubuntu 22.04', criticality: 'low', exposure: 'internal' },
    network: { assetType: 'ip', namePrefix: 'net-onb', os: 'Cisco IOS-XE', criticality: 'high', exposure: 'internal' },
    firewall: { assetType: 'ip', namePrefix: 'fw-onb', os: 'OPNsense 24.x', criticality: 'critical', exposure: 'internet' },
};

/** 2 fictional assets per collector, derived deterministically from the collector's own id so the
 *  result is stable and reproducible — never duplicated on a later tick (caller only invokes this
 *  once, on the collector's first transition into 'operational'). */
export function discoverAssetsForCollector(collector: CollectorRecord, orgDomain: string, nowIso: string): VmsAsset[] {
    const template = CATEGORY_TEMPLATES[collector.infraCategory];
    const shortId = collector.id.replace(/-/g, '').slice(0, 6);
    // Deterministic private-range octets from the collector id — never a real/public address.
    const seed = [...collector.id].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 250, 7);

    return [1, 2].map((n) => {
        const id = `asset-onb-${collector.id}-${n}`;
        const ip = `10.60.${(seed + n) % 250}.${(seed * n) % 250}`;
        const value = template.assetType === 'endpoint' || template.assetType === 'host'
            ? `${template.namePrefix}-${shortId}-${n}.${orgDomain}`
            : ip;
        const asset: VmsAsset = {
            id, asset_type: template.assetType, value,
            hostnames: template.assetType === 'ip' ? [] : [value],
            ips: [ip], dns: template.assetType === 'ip' ? {} : { a: [ip] },
            http: null, exposure: template.exposure, alive: true, owner: null, criticality: template.criticality,
            wazuh_agent_id: template.assetType === 'endpoint' ? `wz-onb-${shortId}-${n}` : null,
            discovery_sources: [`collector:${collector.id}`], first_seen: nowIso, last_seen: nowIso, status: 'active',
            os: template.os,
            ...(template.assetType === 'endpoint' ? { agent_status: 'active', agent_last_keepalive: nowIso, agent_groups: [collector.businessUnit] } : {}),
        };
        return asset;
    });
}
