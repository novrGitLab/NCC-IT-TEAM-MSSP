'use client';

import { useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { useTeamPresence, PresenceStats, PresenceCards, relativeTime } from '@/components/features/TeamPresence';
import { apiUrl, apiFetch } from '@/lib/api';
import { JOB_FUNCTIONS, JOB_FUNCTION_IDS, isJobFunction, jobFunctionLabel, type JobFunction } from '@ncc-it/backend/contracts/invite-functions';

// Team — live status on top (heartbeat presence), then the roster. The roster used to be a
// hardcoded mock list; it is now the real platform_users table, same layout.

const ROLE_BADGE: Record<string, string> = {
    super_admin: 'bg-purple/10 text-purple',
    soc_manager: 'bg-blue/10 text-blue',
    analyst: 'bg-green/10 text-green',
    executive: 'bg-amber/10 text-amber',
    viewer: 'bg-card-muted text-foreground-muted',
};
const ROLE_LABEL: Record<string, string> = {
    super_admin: 'Super Admin', soc_manager: 'SOC Manager', analyst: 'Analyst', executive: 'Executive', viewer: 'Viewer',
};

interface InviteResult {
    sent: boolean;
    reason?: string;
    invite_url?: string;
    invite?: { email: string; jobFunction: string; role: string; scope: Record<string, string> };
}

export default function TeamPage() {
    const { data, error, now } = useTeamPresence();
    const [search, setSearch] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [jobFunction, setJobFunction] = useState<JobFunction>('soc_analyst');
    const [scope, setScope] = useState<Record<string, string>>({});
    const [inviteBusy, setInviteBusy] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

    const def = JOB_FUNCTIONS[jobFunction];
    const missingRequired = def.fields.some((f) => f.required && !(scope[f.key] ?? '').trim());

    const closeInviteModal = () => {
        setShowInviteModal(false);
        setInviteEmail('');
        setJobFunction('soc_analyst');
        setScope({});
        setInviteError(null);
        setInviteResult(null);
    };

    const chooseJobFunction = (value: string) => {
        if (isJobFunction(value)) { setJobFunction(value); setScope({}); setInviteError(null); }
    };

    const setField = (key: string, value: string) => setScope((s) => ({ ...s, [key]: value }));

    const sendInvite = async () => {
        setInviteBusy(true);
        setInviteError(null);
        setInviteResult(null);
        try {
            const res = await apiFetch(apiUrl('/api/invites'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, jobFunction, scope }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) { setInviteError(body?.error ?? `Could not create the invitation (HTTP ${res.status}).`); return; }
            setInviteResult(body);
        } catch {
            setInviteError('Could not reach the server.');
        } finally {
            setInviteBusy(false);
        }
    };

    const members = data?.members ?? [];
    const filtered = members.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const selectCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:outline-none focus:border-purple';

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black text-foreground">Team Members</h1>
                    <p className="text-xs text-foreground-muted">Administration · Live status, activity and access</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 bg-orange hover:bg-orange-hover text-white font-bold px-4 py-2.5 rounded-lg text-sm transition-colors"
                >
                    <UserPlus size={14} />
                    Invite Member
                </button>
            </div>

            {/* Live Team Status */}
            <section className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-foreground">Live Team Status</h2>
                    <p className="text-[10px] text-foreground-muted">Online = active in the last 5 minutes · Away = tab in the background · refreshes every minute</p>
                </div>
                {error ? (
                    <p role="alert" className="text-xs text-red-500 bg-red-500/5 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
                ) : !data ? (
                    <div className="h-24 bg-card-muted/60 rounded-xl animate-pulse" />
                ) : (
                    <>
                        <PresenceStats members={members} />
                        <PresenceCards members={members} now={now} />
                        {data.history === 'since_restart' && (
                            <p className="text-[10px] text-foreground-muted">
                                Activity history covers only the time since the backend last restarted. Run backend/sql/2026-09-team-presence.sql in Supabase to keep it across restarts.
                            </p>
                        )}
                    </>
                )}
            </section>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    aria-label="Search team"
                    className="w-full max-w-sm pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-card
                               focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/10"
                />
            </div>

            {/* Team table */}
            <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full min-w-[640px]">
                    <thead>
                        <tr className="bg-foreground">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-white">Member</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-white">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-white">Account</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-white">Last Active</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-white">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!data ? (
                            <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-foreground-muted">{error ? 'Team unavailable.' : 'Loading team…'}</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-xs text-foreground-muted">
                                    {search ? <>No team members match &ldquo;{search}&rdquo;.</> : 'No team members yet.'}
                                </td>
                            </tr>
                        ) : filtered.map((user, i) => (
                            <tr key={user.email} className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-card' : 'bg-card-muted'}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                            {user.name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm text-foreground">{user.name}</div>
                                            <div className="text-xs text-foreground-muted">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${ROLE_BADGE[user.role] ?? ROLE_BADGE.viewer}`}>
                                        {ROLE_LABEL[user.role] ?? user.role}
                                    </span>
                                    {jobFunctionLabel(user.job_function) && (
                                        <div className="text-[11px] text-foreground-muted mt-1">{jobFunctionLabel(user.job_function)}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${user.account_status === 'active' ? 'bg-green/10 text-green' : 'bg-amber/10 text-amber'}`}>
                                        {user.account_status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-foreground-muted">{user.status === 'offline' ? relativeTime(user.last_active, now) : 'Now'}</td>
                                <td className="px-4 py-3">
                                    <span className="text-xs text-foreground-muted" title="Role changes and removal are not wired to the backend yet">Edit / Remove — not available yet</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-foreground-muted">
                Roster from the platform records. Role changes and removal are not available yet. Invitations are recorded locally. Email delivery is off in this environment.
            </p>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl shadow-xl w-full max-w-md border border-border max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h2 className="font-bold text-base text-foreground">Invite Team Member</h2>
                            <button onClick={closeInviteModal} className="text-foreground-muted hover:text-foreground" aria-label="Close">✕</button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            {inviteResult ? (
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-foreground">Invitation recorded for {inviteResult.invite?.email ?? inviteEmail}</p>
                                    {inviteResult.invite && (
                                        <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-card-muted rounded-lg p-3">
                                            <dt className="text-foreground-muted">Job function</dt>
                                            <dd className="text-foreground">{JOB_FUNCTIONS[inviteResult.invite.jobFunction as JobFunction]?.label ?? inviteResult.invite.jobFunction}</dd>
                                            <dt className="text-foreground-muted">Platform role</dt>
                                            <dd className="text-foreground">{ROLE_LABEL[inviteResult.invite.role] ?? inviteResult.invite.role}</dd>
                                            {Object.entries(inviteResult.invite.scope).map(([k, v]) => {
                                                const field = JOB_FUNCTIONS[inviteResult.invite!.jobFunction as JobFunction]?.fields.find((f) => f.key === k);
                                                return (
                                                    <div key={k} className="contents">
                                                        <dt className="text-foreground-muted">{field?.label ?? k}</dt>
                                                        <dd className="text-foreground">{v}</dd>
                                                    </div>
                                                );
                                            })}
                                        </dl>
                                    )}
                                    {inviteResult.sent ? (
                                        <p className="text-xs text-foreground-muted">Invitation email delivered.</p>
                                    ) : (
                                        <>
                                            <p className="text-xs text-foreground-muted">
                                                Recorded locally. No email was sent. Share this link with {inviteResult.invite?.email ?? inviteEmail} directly:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input readOnly value={inviteResult.invite_url ?? ''} className="flex-1 border border-border rounded-lg px-3 py-2 text-xs font-mono bg-card-muted" />
                                                <button
                                                    onClick={() => { void navigator.clipboard.writeText(inviteResult.invite_url ?? ''); }}
                                                    className="text-xs font-bold text-white bg-purple rounded-lg px-3 py-2 shrink-0"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label htmlFor="invite-email" className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
                                            Email Address
                                        </label>
                                        <input
                                            id="invite-email" type="email" value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card
                                                       focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/10"
                                            placeholder="analyst@company.com"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="invite-function" className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
                                            Job function
                                        </label>
                                        <select id="invite-function" value={jobFunction} onChange={(e) => chooseJobFunction(e.target.value)} className={selectCls}>
                                            {JOB_FUNCTION_IDS.map((id) => <option key={id} value={id}>{JOB_FUNCTIONS[id].label}</option>)}
                                        </select>
                                        <p className="text-[11px] text-foreground-muted mt-1.5">{def.summary}</p>
                                    </div>

                                    {def.fields.map((field) => (
                                        <div key={field.key}>
                                            {field.key === 'full_access_confirmed' ? (
                                                <label className="flex items-start gap-2 text-xs text-foreground">
                                                    <input type="checkbox" className="mt-0.5" checked={scope[field.key] === 'confirmed'}
                                                        onChange={(e) => setField(field.key, e.target.checked ? 'confirmed' : '')} />
                                                    <span>{field.label}</span>
                                                </label>
                                            ) : (
                                                <>
                                                    <label htmlFor={`scope-${field.key}`} className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
                                                        {field.label}{field.required ? ' *' : ''}
                                                    </label>
                                                    {field.options ? (
                                                        <select id={`scope-${field.key}`} value={scope[field.key] ?? ''} onChange={(e) => setField(field.key, e.target.value)} className={selectCls}>
                                                            <option value="">Select…</option>
                                                            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                                        </select>
                                                    ) : (
                                                        <input id={`scope-${field.key}`} value={scope[field.key] ?? ''} onChange={(e) => setField(field.key, e.target.value)}
                                                            placeholder={field.help} className={selectCls} />
                                                    )}
                                                    {field.help && field.options === undefined && <p className="text-[11px] text-foreground-muted mt-1">{field.help}</p>}
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    <div className="bg-[#F1F6FF] border border-[#DBEAFE] rounded-lg p-3 text-xs text-foreground-muted">
                                        The invitation and its scope are recorded locally. Access is granted by the platform role only; the scoped fields are not enforced yet.
                                    </div>
                                    {inviteError && <p role="alert" className="text-xs text-red-500 font-semibold">{inviteError}</p>}
                                </>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                            <button onClick={closeInviteModal} className="text-sm text-foreground-muted px-4 py-2 rounded-lg hover:bg-card-muted">
                                Close
                            </button>
                            {!inviteResult && (
                                <button
                                    onClick={() => void sendInvite()}
                                    disabled={inviteBusy || !inviteEmail || missingRequired}
                                    className="text-sm font-bold bg-orange hover:bg-orange-hover text-white px-5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {inviteBusy ? 'Recording…' : 'Create Invitation'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
