// Single source of truth for the admin and client sidebars.
//
// Each item carries:
//   id       stable identifier (also used by scripts/check-nav-routes.mjs in reports)
//   label    text shown in the sidebar
//   href     route; must resolve to a page under src/app (enforced by `npm run check:nav`)
//   domain   product area the item belongs to
//   status   implementation status, using the audit's labels (docs/audit/NOVRSOC_AUDIT.md),
//            updated for the 2026-10 cleanup: WORKING, PARTIAL, MOCK, BROKEN, PLANNED.
//            Metadata only — the sidebar does not display it.
//   roles    'all' (every authenticated role, no filter) or an explicit allow-list.
//
// Sidebar.tsx's own role filter is unchanged: `roles: 'all'` maps to "no roles field" (visible
// to any role, as before), and an explicit list maps to NavItem.roles. The previous adminOnly
// flag equals ['super_admin'] and managerOnly equals ['super_admin', 'soc_manager'].
//
// v2 features (Mobile Application Security, Code Security, Shadow IT) are not listed in the
// admin nav. Their pages may still exist; they are simply not linked.
import {
    LayoutDashboard, FileBarChart, Users, Shield,
    Crosshair, AlertTriangle, Link as LinkIcon, Server, Network, ShieldCheck, Radar,
    ShieldAlert, Activity, Zap, Siren,
    BarChart, Settings, BookOpen, FileText, ScrollText,
    ClipboardCheck, Map, Radio, Cloud, Bell, Monitor,
    Target, Fingerprint, CalendarRange,
    Sparkles, Rocket,
    type LucideIcon,
} from 'lucide-react';
import type { NavGroup, NavItem, NavRole } from '@/components/layout/Sidebar';
import { VMS_SECTIONS } from './vmsSections';

export type NavStatus = 'WORKING' | 'PARTIAL' | 'MOCK' | 'BROKEN' | 'PLANNED';
export type NavDomain =
    | 'overview' | 'secops' | 'vms' | 'threat-intel' | 'cnii' | 'brand' | 'infra' | 'email'
    | 'compliance' | 'ai' | 'data' | 'clients' | 'settings' | 'account';

export interface NavItemConfig {
    id: string;
    label: string;
    href: string;
    domain: NavDomain;
    status: NavStatus;
    roles: 'all' | NavRole[];
    icon: LucideIcon;
    /** Sub-page route prefixes that keep this item highlighted (see Sidebar isNavItemActive). */
    match?: string[];
}

export interface NavSectionConfig {
    section: string;
    collapsible: boolean;
    icon?: LucideIcon;
    groupLabel?: string;
    items: NavItemConfig[];
}

const NOT_EXEC: NavRole[] = ['super_admin', 'soc_manager', 'analyst'];
const MANAGER_PLUS_EXEC: NavRole[] = ['super_admin', 'soc_manager', 'executive'];
const MANAGER_ONLY: NavRole[] = ['super_admin', 'soc_manager'];
const SUPER_ADMIN: NavRole[] = ['super_admin'];
// VMS is readable by executives too (their organisation's attack surface and risk).
/** VMS_READ also gates the Threat Information System: the backend's vms:read and intel:read go to the same roles. */
const VMS_READ: NavRole[] = ['super_admin', 'soc_manager', 'analyst', 'executive'];

export const ADMIN_NAV: NavSectionConfig[] = [
    {
        section: 'Overview', collapsible: true, icon: LayoutDashboard, groupLabel: 'Overview',
        items: [
            { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard', domain: 'overview', status: 'PARTIAL', roles: 'all', icon: LayoutDashboard },
            { id: 'executive-report', label: 'Executive Report', href: '/admin/dashboard/executive', domain: 'overview', status: 'WORKING', roles: MANAGER_PLUS_EXEC, icon: FileBarChart },
        ],
    },
    {
        // executive: hidden. Sec Ops Management is manager-only.
        section: 'Security Operations', collapsible: true, icon: Activity, groupLabel: 'Security Operations',
        items: [
            { id: 'cases', label: 'Cases', href: '/admin/secops/cases', domain: 'secops', status: 'WORKING', roles: NOT_EXEC, icon: FileText },
            { id: 'alerts', label: 'Alerts', href: '/admin/secops/alerts', domain: 'secops', status: 'PARTIAL', roles: NOT_EXEC, icon: Bell },
            { id: 'threats', label: 'Threats', href: '/admin/secops/threats', domain: 'secops', status: 'WORKING', roles: NOT_EXEC, icon: ShieldAlert },
            { id: 'mitre', label: 'MITRE Intelligence', href: '/admin/secops/mitre', domain: 'secops', status: 'PARTIAL', roles: NOT_EXEC, icon: Shield },
            { id: 'playbooks', label: 'Playbooks', href: '/admin/secops/playbooks', domain: 'secops', status: 'PARTIAL', roles: NOT_EXEC, icon: BookOpen },
            { id: 'soar', label: 'SOAR Automation', href: '/admin/secops/soar', domain: 'secops', status: 'WORKING', roles: NOT_EXEC, icon: Zap },
            { id: 'response-approvals', label: 'Response Approvals', href: '/admin/secops/approvals', domain: 'secops', status: 'WORKING', roles: NOT_EXEC, icon: ShieldCheck },
            { id: 'weekly-insights', label: 'Weekly Insights', href: '/admin/secops/insights', domain: 'secops', status: 'WORKING', roles: NOT_EXEC, icon: CalendarRange },
            { id: 'security-assessment', label: 'Security Assessment', href: '/admin/secops/security-assessment', domain: 'secops', status: 'WORKING', roles: MANAGER_PLUS_EXEC, icon: ClipboardCheck },
            { id: 'secops-management', label: 'Sec Ops Management', href: '/admin/secops/management', domain: 'secops', status: 'PARTIAL', roles: MANAGER_ONLY, icon: Settings },
        ],
    },
    {
        // VMS redesign (P20): eight sections; each section's pages are tabs in app/admin/vms/layout.tsx
        // (config/vmsSections.ts). Scanner Operations is for managers — the backend enforces it
        // (its data comes from vms:scope endpoints), not only this list.
        section: 'Vulnerability Management', collapsible: true, icon: Radar, groupLabel: 'Vulnerability Management',
        items: VMS_SECTIONS.map((s): NavItemConfig => ({ id: `vms-${s.id}`, label: s.label, href: s.href, domain: 'vms', status: 'WORKING', roles: s.managerOnly ? MANAGER_ONLY : VMS_READ, icon: s.icon, match: s.pages.map((p) => p.href).filter((h) => h !== '/admin/vms') })),
    },
    {
        // Threat Intelligence V1 (P25): eight pages. The external IOC lookup and the URL & web
        // scanner are tools linked from Indicators & Investigation; the older pages redirect here.
        section: 'Threat Intelligence', collapsible: true, icon: Crosshair, groupLabel: 'Threat Intelligence',
        items: [
            { id: 'ti-overview', label: 'Overview', href: '/admin/ti', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Crosshair },
            { id: 'ti-map', label: 'Nigeria Threat Map', href: '/admin/ti/map', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Map },
            { id: 'ti-indicators', label: 'Indicators & Investigation', href: '/admin/ti/indicators', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Fingerprint, match: ['/admin/threat/cti', '/admin/threat/urlscan', '/admin/threat/webscan'] },
            { id: 'ti-actors', label: 'Threat Actors', href: '/admin/ti/actors', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Users },
            { id: 'ti-matches', label: 'Organisation Matches', href: '/admin/ti/matches', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Target },
            { id: 'ti-vulnerabilities', label: 'Vulnerabilities & Advisories', href: '/admin/ti/vulnerabilities', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: ShieldAlert },
            { id: 'ti-analyst', label: 'AI Intelligence Analyst', href: '/admin/ti/analyst', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Sparkles },
            { id: 'ti-sources', label: 'Sources & Exchange', href: '/admin/ti/sources', domain: 'threat-intel', status: 'WORKING', roles: VMS_READ, icon: Radio },
        ],
    },
    {
        section: 'Infrastructure & Assets', collapsible: true, icon: Server, groupLabel: 'Infrastructure & Assets',
        items: [
            // Unified inventory (P14): Wazuh-managed and external assets, one record set (VMS Attack Surface).
            { id: 'infra-inventory', label: 'Asset Inventory', href: '/admin/vms/assets', domain: 'infra', status: 'WORKING', roles: VMS_READ, icon: Server },
            { id: 'digital-assets', label: 'Wazuh Endpoints', href: '/admin/infra/assets', domain: 'infra', status: 'WORKING', roles: NOT_EXEC, icon: Monitor },
            { id: 'cloud-assets', label: 'Cloud Assets', href: '/admin/infra/cloud', domain: 'infra', status: 'PARTIAL', roles: NOT_EXEC, icon: Cloud },
        ],
    },
    {
        section: 'Onboarding', collapsible: true, icon: Rocket, groupLabel: 'Onboarding',
        items: [
            { id: 'onboarding-new', label: 'Collector Onboarding', href: '/admin/onboarding/new', domain: 'infra', status: 'WORKING', roles: MANAGER_PLUS_EXEC, icon: Rocket },
        ],
    },
    {
        section: 'Settings', collapsible: true, icon: Settings, groupLabel: 'Settings',
        items: [
            { id: 'team', label: 'Team', href: '/admin/settings/team', domain: 'settings', status: 'WORKING', roles: SUPER_ADMIN, icon: Users },
            { id: 'analytics', label: 'Analytics', href: '/admin/settings/analytics', domain: 'settings', status: 'WORKING', roles: SUPER_ADMIN, icon: BarChart },
            { id: 'audit-log', label: 'Audit Log', href: '/admin/settings/audit', domain: 'settings', status: 'PARTIAL', roles: SUPER_ADMIN, icon: ScrollText },
            { id: 'platform-health', label: 'Platform Health', href: '/admin/settings/health', domain: 'settings', status: 'WORKING', roles: MANAGER_ONLY, icon: Activity },
        ],
    },
];

// Client portal. Status labels below reflect each page's own data completeness, not a shared
// backend outage — the portal signs in and reads data through the same local API surface as the
// admin app (src/lib/api.ts).
export const CLIENT_NAV: NavSectionConfig[] = [
    {
        section: '', collapsible: false,
        items: [
            { id: 'client-dashboard', label: 'Dashboard', href: '/client/dashboard', domain: 'overview', status: 'PARTIAL', roles: 'all', icon: LayoutDashboard },
        ],
    },
    {
        // Client VMS portal (P21): the client's own organisation, read from /api/client/vms.
        section: 'Vulnerability Management', collapsible: true, icon: Radar, groupLabel: 'Vulnerability Management',
        items: [
            { id: 'client-vms-overview', label: 'Overview', href: '/client/vms', domain: 'vms', status: 'WORKING', roles: 'all', icon: Radar },
            { id: 'client-vms-assets', label: 'Assets', href: '/client/vms/assets', domain: 'vms', status: 'WORKING', roles: 'all', icon: Server },
            { id: 'client-vms-findings', label: 'Vulnerabilities', href: '/client/vms/findings', domain: 'vms', status: 'WORKING', roles: 'all', icon: ShieldAlert },
            { id: 'client-vms-remediation', label: 'Remediation', href: '/client/vms/remediation', domain: 'vms', status: 'WORKING', roles: 'all', icon: ClipboardCheck },
            { id: 'client-vms-reports', label: 'Reports', href: '/client/vms/reports', domain: 'vms', status: 'WORKING', roles: 'all', icon: FileBarChart },
        ],
    },
    {
        section: 'Threat Intelligence', collapsible: true, icon: Crosshair, groupLabel: 'Threat Intelligence',
        items: [
            { id: 'client-cti', label: 'CTI Platform', href: '/client/threat/cti', domain: 'threat-intel', status: 'BROKEN', roles: 'all', icon: Crosshair },
            { id: 'client-threat-advisory', label: 'Threat Advisory', href: '/client/threat/advisory', domain: 'threat-intel', status: 'BROKEN', roles: 'all', icon: AlertTriangle },
            { id: 'client-urlscan', label: 'URL Scan Suite', href: '/client/threat/urlscan', domain: 'threat-intel', status: 'BROKEN', roles: 'all', icon: LinkIcon },
            { id: 'client-webscan', label: 'Website Scanning', href: '/client/threat/webscan', domain: 'threat-intel', status: 'BROKEN', roles: 'all', icon: Monitor },
        ],
    },
    {
        section: 'Infrastructure', collapsible: true, icon: Server, groupLabel: 'Infrastructure',
        items: [
            { id: 'client-digital-assets', label: 'Digital Assets', href: '/client/infra/assets', domain: 'infra', status: 'PARTIAL', roles: 'all', icon: Server },
            { id: 'client-dns', label: 'DNS Suite', href: '/client/infra/dns', domain: 'infra', status: 'BROKEN', roles: 'all', icon: Network },
        ],
    },
    {
        section: 'SecOps & Response', collapsible: true, icon: Activity, groupLabel: 'SecOps & Response',
        items: [
            { id: 'client-threat-management', label: 'Security Alerts', href: '/client/secops/threats', domain: 'secops', status: 'PARTIAL', roles: 'all', icon: Activity },
            { id: 'client-cases', label: 'Cases', href: '/client/secops/cases', domain: 'secops', status: 'BROKEN', roles: 'all', icon: Siren },
            { id: 'client-report-card', label: 'Security Report Card', href: '/client/secops/security-assessment', domain: 'secops', status: 'BROKEN', roles: 'all', icon: Activity },
            { id: 'client-alert-communication', label: 'Alert Communication', href: '/client/secops/alerts', domain: 'secops', status: 'BROKEN', roles: 'all', icon: Bell },
        ],
    },
];

/** Converts config sections into the NavGroup shape Sidebar.tsx renders. */
export function toNavGroups(sections: NavSectionConfig[]): NavGroup[] {
    return sections.map(({ items, ...section }) => ({
        ...section,
        items: items.map(({ label, href, icon, roles, match }): NavItem => ({ label, href, icon, ...(roles === 'all' ? {} : { roles }), ...(match?.length ? { match } : {}) })),
    }));
}

/** Every href in both navs — used by scripts/check-nav-routes.mjs. */
export const ALL_NAV_HREFS: string[] = [...ADMIN_NAV, ...CLIENT_NAV].flatMap((s) => s.items.map((i) => i.href));
