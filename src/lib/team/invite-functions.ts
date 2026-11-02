// Job functions an invitation can be issued for. Each maps onto one of the platform's existing
// roles (the role decides what the account can do) and carries its own scoped fields, which are
// recorded on the invitation. Shared by the invite form and the invite API so both validate
// against the same definition.

export type JobFunction = 'soc_analyst' | 'vuln_analyst' | 'security_manager' | 'super_admin' | 'executive_viewer';
export type PlatformRole = 'super_admin' | 'soc_manager' | 'analyst' | 'executive';

export interface ScopeField {
    key: string;
    label: string;
    help?: string;
    options?: readonly string[];
    required?: boolean;
}

export interface JobFunctionDef {
    label: string;
    role: PlatformRole;
    summary: string;
    fields: readonly ScopeField[];
}

export const JOB_FUNCTIONS: Record<JobFunction, JobFunctionDef> = {
    soc_analyst: {
        label: 'SOC Analyst',
        role: 'analyst',
        summary: 'Triages and responds to alerts and cases.',
        fields: [
            { key: 'soc_team', label: 'SOC team', options: ['Tier 1 — Triage', 'Tier 2 — Investigation', 'Tier 3 — Threat hunting'], required: true },
            { key: 'shift', label: 'Shift', options: ['Day', 'Night', 'Rotating'], required: true },
            { key: 'incident_access', label: 'Incident access', options: ['Read only', 'Triage and update', 'Full response'], required: true },
        ],
    },
    vuln_analyst: {
        label: 'Vulnerability Analyst',
        role: 'analyst',
        summary: 'Owns findings and remediation for assigned asset groups.',
        fields: [
            { key: 'asset_groups', label: 'Asset groups', help: 'Comma-separated, e.g. "Platform servers, Finance endpoints"', required: true },
            { key: 'remediation_responsibility', label: 'Remediation responsibility', options: ['Patch owner', 'Verification only', 'Patch owner and verification'], required: true },
        ],
    },
    security_manager: {
        label: 'Security Manager',
        role: 'soc_manager',
        summary: 'Approves response actions and escalates within scope.',
        fields: [
            { key: 'approval_permissions', label: 'Approval permissions', options: ['Playbook actions', 'Response actions', 'Playbook and response actions'], required: true },
            { key: 'escalation_scope', label: 'Escalation scope', options: ['Own team', 'All SOC', 'Organisation-wide'], required: true },
        ],
    },
    super_admin: {
        label: 'Super Admin',
        role: 'super_admin',
        summary: 'Full platform access, including team and organisation settings.',
        fields: [
            { key: 'full_access_confirmed', label: 'I confirm this person needs full platform access', options: ['confirmed'], required: true },
        ],
    },
    executive_viewer: {
        label: 'Executive / Viewer',
        role: 'executive',
        summary: 'Read-only access to reports and posture.',
        fields: [
            { key: 'reporting_scope', label: 'Reporting scope', options: ['Executive dashboard', 'Security posture', 'Full reports'], required: true },
        ],
    },
};

export const JOB_FUNCTION_IDS = Object.keys(JOB_FUNCTIONS) as JobFunction[];

export function isJobFunction(value: unknown): value is JobFunction {
    return typeof value === 'string' && (JOB_FUNCTION_IDS as string[]).includes(value);
}

export function jobFunctionLabel(value: string | null | undefined): string | null {
    return isJobFunction(value) ? JOB_FUNCTIONS[value].label : null;
}

/** Validates the scoped answers for one job function. Returns only the known keys. */
export function sanitizeScope(fn: JobFunction, input: unknown): { ok: true; scope: Record<string, string> } | { ok: false; error: string } {
    const answers = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const scope: Record<string, string> = {};
    for (const field of JOB_FUNCTIONS[fn].fields) {
        const raw = typeof answers[field.key] === 'string' ? (answers[field.key] as string).trim() : '';
        if (field.required && !raw) return { ok: false, error: `${field.label} is required.` };
        if (field.options && raw && !field.options.includes(raw)) return { ok: false, error: `${field.label} has an unsupported value.` };
        if (raw.length > 200) return { ok: false, error: `${field.label} is too long.` };
        if (raw) scope[field.key] = raw;
    }
    return { ok: true, scope };
}
