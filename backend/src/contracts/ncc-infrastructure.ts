// NCC IT critical infrastructure register. Names, types and hosting descriptions are taken from the
// register supplied by NCC; they are not renamed or reclassified here. An entry describes what NCC
// owns or manages. It does not mean an instance has been discovered, connected or monitored.
// Browser-safe: no server imports.

export interface NccInfrastructureItem {
    id: string;
    no: number;
    name: string;
    /** Register "Type" column, verbatim. */
    type: string;
    /** Register "Hosting / Service" column, verbatim. */
    hosting: string;
    /** Quantity given in the register, when one is stated. */
    quantity: number | null;
    /** Infrastructure category the collector engine uses for method selection and ingestion labels. */
    engineCategory: 'servers' | 'cloud' | 'endpoints' | 'network' | 'firewall';
}

export const NCC_INFRASTRUCTURE: readonly NccInfrastructureItem[] = [
    { id: 'ncc-infra-01', no: 1, name: 'ITSM (ServiceDesk Plus)', type: 'Managed Engine Cloud Service', hosting: 'IT Service Request Management', quantity: null, engineCategory: 'cloud' },
    { id: 'ncc-infra-02', no: 2, name: 'Microsoft Intune', type: 'Microsoft 365 Cloud based Service', hosting: 'End user devices Management', quantity: null, engineCategory: 'endpoints' },
    { id: 'ncc-infra-03', no: 3, name: 'Linux VPS', type: 'Web server', hosting: 'NCC Websites and other webservices', quantity: null, engineCategory: 'servers' },
    { id: 'ncc-infra-04', no: 4, name: 'Windows VPS', type: 'Web server', hosting: 'E-Services applications (e.g TAMSY, LAMS, OMS), Staff Payment, Third-party Payment, etc.', quantity: null, engineCategory: 'servers' },
    { id: 'ncc-infra-05', no: 5, name: 'Microsoft SharePoint Portal', type: 'Server, On-Prem / Cloud based Service', hosting: 'NCC SharePoint Portal', quantity: null, engineCategory: 'servers' },
    { id: 'ncc-infra-06', no: 6, name: 'Micro Focus Data Protector', type: 'Server, On-Prem', hosting: 'Data backup and restore', quantity: null, engineCategory: 'servers' },
    { id: 'ncc-infra-07', no: 7, name: 'Microsoft Dynamic Great Plains', type: 'Server, On-Prem / Cloud based Service', hosting: 'NCC Enterprise Accounting Software', quantity: null, engineCategory: 'servers' },
    { id: 'ncc-infra-08', no: 8, name: 'SolarWinds', type: 'Networking Monitoring Tool', hosting: 'Networking Monitoring Services', quantity: null, engineCategory: 'network' },
    { id: 'ncc-infra-09', no: 9, name: 'Sophos XGS', type: 'Firewall', hosting: 'Core Networking Services', quantity: 2, engineCategory: 'firewall' },
    { id: 'ncc-infra-10', no: 10, name: 'Cisco Catalyst 8300', type: 'EDGE Router', hosting: 'Core Networking Services', quantity: 2, engineCategory: 'network' },
    { id: 'ncc-infra-11', no: 11, name: 'Mikrotik CCR2004', type: 'EDGE Router', hosting: 'Core Networking Services', quantity: 1, engineCategory: 'network' },
    { id: 'ncc-infra-12', no: 12, name: 'Cisco Firepower 3140', type: 'Firewall', hosting: 'Core Networking Services', quantity: 1, engineCategory: 'firewall' },
    { id: 'ncc-infra-13', no: 13, name: 'Cisco Firepower 2130', type: 'Firewall', hosting: 'Core Networking Services', quantity: 1, engineCategory: 'firewall' },
    { id: 'ncc-infra-14', no: 14, name: 'Cisco Catalyst 9500', type: 'Core Switch', hosting: 'Core Networking Services', quantity: 2, engineCategory: 'network' },
    { id: 'ncc-infra-15', no: 15, name: 'Cisco Catalyst 9300', type: 'Access Switch', hosting: 'Core Networking Services', quantity: 24, engineCategory: 'network' },
    { id: 'ncc-infra-16', no: 16, name: 'Huawei CloudEngine S6750', type: 'Aggregation Switch', hosting: 'Wireless Networking Services', quantity: null, engineCategory: 'network' },
    { id: 'ncc-infra-17', no: 17, name: 'iMaster NCE CampusInsight', type: 'Networking Monitoring Tool', hosting: 'Wireless Networking Monitoring Services', quantity: null, engineCategory: 'network' },
];

export const NCC_INFRASTRUCTURE_BY_ID: ReadonlyMap<string, NccInfrastructureItem> = new Map(NCC_INFRASTRUCTURE.map((i) => [i.id, i]));

export function nccInfrastructureById(id: string | null | undefined): NccInfrastructureItem | null {
    return id ? NCC_INFRASTRUCTURE_BY_ID.get(id) ?? null : null;
}
