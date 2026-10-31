export interface AccountOrg {
    id: number;
    name: string;
    industry: string;
    plan: string;
    contact_name: string;
    contact_email: string;
    wazuh_group: string;
    status: string;
    created_at: string;
    endpoints_limit: number;
}

export interface AccountStats {
    total_endpoints: number;
    active_incidents: number;
    total_incidents_alltime: number;
    advisories_received: number;
    vendor_assessments: number;
    scans_performed: number;
    member_count: number;
}

export interface AccountSubscription {
    plan: string;
    endpoints_used: number;
    endpoints_limit: number;
    usage_percent: number;
    renewal_date: string;
}

export interface AccountData {
    org: AccountOrg;
    stats: AccountStats;
    subscription: AccountSubscription;
}

export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('portal_token') || localStorage.getItem('admin_token');
}
