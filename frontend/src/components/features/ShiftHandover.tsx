'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileDown, Send, RefreshCw, AlertTriangle, Clock, ChevronDown, ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiUrl, apiFetch } from '@/lib/api';
import { getAdminUser } from '@/lib/admin-auth';
import { exportDataAsPDF } from '@/lib/exportPDF';

// Shift handover — an explicit four-step workflow: Generate (compile the draft from the current
// shift window and today's cases) → Review (read the compiled summary) → Edit notes (watch items
// and free-text notes stay editable through review) → Confirm (persisted via POST
// /api/secops/handover, an engine-backed record — not an external service). History is read back
// from the same endpoint, so what's shown there is exactly what was submitted, nothing re-derived.
//
// Honesty rules this page keeps: a failed case load is shown as a failure (never as "no critical
// cases"), and it only claims a handover was saved once the backend has confirmed the write.

interface ShiftCase {
    id: string; number: string; title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'investigating' | 'contained' | 'resolved';
    assigned: string; created_at: string;
}
interface CaseRow {
    id: string; case_number: string; title: string; severity: ShiftCase['severity']; status: ShiftCase['status'];
    assigned_to: string | null; created_at: string;
}
interface HandoverLog {
    id: string; shiftStart: string; shiftEnd: string; analystOn: string; analystOff: string;
    casesReceived: number; casesResolved: number; casesPending: number;
    criticalCases: string[]; ongoingCases: string[]; watchPriority: 'Low' | 'Medium' | 'High'; watchItems: string; notes: string;
    submittedBy: string; submittedAt: string;
}
interface TeamMember { name: string; email: string; role: string; disabled: boolean }

const WATCH_PRIORITIES = ['Low', 'Medium', 'High'] as const;
const OTHER = '__other__';
type Step = 'editing' | 'review' | 'done';

const toLocalInput = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = (v: string) => (v ? new Date(v).getTime() : NaN);
const fmt = (ms: number) => (Number.isNaN(ms) ? '—' : new Date(ms).toLocaleString());

type CasesState = { kind: 'loading' } | { kind: 'ready'; key: string; cases: ShiftCase[] } | { kind: 'error'; key: string; message: string };

// Cases created since the window's start (the end bound is applied by the caller). The result is
// tagged with the window key, so a slower response for an old window can't overwrite a newer one.
function loadShiftCases(key: string, set: (s: CasesState) => void, isActive: () => boolean = () => true) {
    const [s] = key.split('|');
    const params = new URLSearchParams({ exclude_auto_closed: 'true', limit: '200', since: new Date(Number(s)).toISOString() });
    return apiFetch(apiUrl(`/api/cases?${params}`), { cache: 'no-store' })
        .then(async (r) => {
            const d = await r.json().catch(() => null);
            if (!isActive()) return;
            if (!r.ok || !d || !Array.isArray(d.cases)) { set({ kind: 'error', key, message: d?.error ?? `HTTP ${r.status}` }); return; }
            set({
                kind: 'ready', key,
                cases: (d.cases as CaseRow[]).map((c) => ({
                    id: c.id, number: c.case_number, title: c.title, severity: c.severity, status: c.status,
                    assigned: c.assigned_to || 'Unassigned', created_at: c.created_at,
                })),
            });
        })
        .catch(() => { if (isActive()) set({ kind: 'error', key, message: 'Could not reach the backend' }); });
}

export function ShiftHandover() {
    const admin = getAdminUser();

    const [step, setStep] = useState<Step>('editing');
    const [shiftStart, setShiftStart] = useState(() => toLocalInput(Date.now() - 12 * 3600_000));
    const [shiftEnd, setShiftEnd] = useState(() => toLocalInput(Date.now()));
    const [analystOff, setAnalystOff] = useState(admin.name || admin.email || '');
    const [comingOn, setComingOn] = useState('');
    const [comingOnOther, setComingOnOther] = useState('');
    const [watchItems, setWatchItems] = useState('');
    const [watchPriority, setWatchPriority] = useState<typeof WATCH_PRIORITIES[number]>('Medium');
    const [notes, setNotes] = useState('');

    const [team, setTeam] = useState<TeamMember[] | null>(null);
    const [casesState, setCasesState] = useState<CasesState>({ kind: 'loading' });
    const [pastLogs, setPastLogs] = useState<HandoverLog[] | null>(null);
    const [pastError, setPastError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [justSubmitted, setJustSubmitted] = useState<HandoverLog | null>(null);

    const startMs = fromLocalInput(shiftStart);
    const endMs = fromLocalInput(shiftEnd);
    const rangeValid = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;
    const casesKey = rangeValid ? `${startMs}|${endMs}` : 'invalid';

    const fetchPast = () =>
        apiFetch(apiUrl('/api/secops/handover'), { cache: 'no-store' })
            .then(async (r) => {
                const d = await r.json().catch(() => null);
                if (!r.ok || !d) { setPastError(d?.error ?? `HTTP ${r.status}`); return; }
                setPastError(null);
                setPastLogs(Array.isArray(d.logs) ? d.logs : []);
            })
            .catch(() => setPastError('Could not reach the backend'));

    useEffect(() => {
        let active = true;
        apiFetch(apiUrl('/api/secops/team'), { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (active) setTeam(Array.isArray(d?.members) ? d.members.filter((m: TeamMember) => !m.disabled) : []); })
            .catch(() => { if (active) setTeam([]); });
        void fetchPast();
        return () => { active = false; };
    }, []);

    // Refetch whenever the shift window changes; stale responses are ignored.
    useEffect(() => {
        if (casesKey === 'invalid') return;
        let active = true;
        void loadShiftCases(casesKey, setCasesState, () => active);
        return () => { active = false; };
    }, [casesKey]);

    const current = casesState.kind !== 'loading' && casesState.key === casesKey ? casesState : null;
    const casesLoading = rangeValid && current === null;
    const casesError = current?.kind === 'error' ? current.message : null;

    const shiftCases = useMemo(() => (current?.kind === 'ready'
        ? current.cases.filter((c) => { const t = Date.parse(c.created_at); return t >= startMs && t <= endMs; })
        : []), [current, startMs, endMs]);

    const critical = shiftCases.filter((c) => c.severity === 'critical');
    const ongoing = shiftCases.filter((c) => c.status !== 'resolved');
    const received = shiftCases.length;
    const resolved = shiftCases.filter((c) => c.status === 'resolved').length;
    const pending = received - resolved;
    const dataReady = current?.kind === 'ready';

    const comingOnName = comingOn === OTHER ? comingOnOther.trim() : comingOn;
    const canGenerate = rangeValid && dataReady && !casesError && analystOff.trim() && comingOnName;

    const refresh = () => {
        if (rangeValid) { setCasesState({ kind: 'loading' }); void loadShiftCases(casesKey, setCasesState); }
        void fetchPast();
    };

    function buildSections() {
        return [
            {
                heading: 'Shift Summary',
                rows: [
                    { label: 'Shift', value: `${fmt(startMs)} → ${fmt(endMs)}` },
                    { label: 'Analyst Going Off', value: analystOff || '—' },
                    { label: 'Analyst Coming On', value: comingOnName || '—' },
                    { label: 'Cases Received', value: String(received) },
                    { label: 'Cases Resolved', value: String(resolved) },
                    { label: 'Cases Pending', value: String(pending) },
                ],
            },
            {
                heading: 'Critical Cases This Shift',
                rows: critical.length > 0 ? critical.map((c) => ({ label: c.number, value: `${c.title} (${c.status})` })) : [{ label: 'None', value: 'No critical cases this shift' }],
            },
            {
                heading: 'Ongoing Cases Requiring Follow-Up',
                rows: ongoing.length > 0 ? ongoing.map((c) => ({ label: c.number, value: `${c.title} — ${c.status}, assigned to ${c.assigned}` })) : [{ label: 'None', value: 'Nothing carried forward' }],
            },
            { heading: 'Watch Items for Next Shift', rows: [{ label: `Priority: ${watchPriority}`, value: watchItems || '—' }] },
            { heading: 'Notes', rows: [{ label: 'Free text', value: notes || '—' }] },
        ];
    }

    async function handleSubmit() {
        if (!canGenerate) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await apiFetch(apiUrl('/api/secops/handover'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftStart: new Date(startMs).toISOString(),
                    shiftEnd: new Date(endMs).toISOString(),
                    analystOn: comingOnName,
                    analystOff: analystOff.trim(),
                    casesReceived: received,
                    casesResolved: resolved,
                    casesPending: pending,
                    criticalCases: critical.map((c) => `${c.number} — ${c.title}`),
                    ongoingCases: ongoing.map((c) => `${c.number} — ${c.title} (${c.status})`),
                    watchPriority,
                    watchItems,
                    notes,
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.success) { setSubmitError(body?.error ?? 'Failed to submit handover.'); return; }
            setJustSubmitted(body.log as HandoverLog);
            setStep('done');
            void fetchPast();
        } catch {
            setSubmitError('Could not reach the handover service.');
        } finally {
            setSubmitting(false);
        }
    }

    function startAnother() {
        setStep('editing');
        setJustSubmitted(null);
        setSubmitError(null);
        setNotes('');
        setWatchItems('');
        setAnalystOff(comingOnName || admin.name || admin.email || '');
        setComingOn('');
        setComingOnOther('');
        setShiftStart(toLocalInput(Date.now()));
        setShiftEnd(toLocalInput(Date.now() + 12 * 3600_000));
    }

    const SEV_STYLE: Record<ShiftCase['severity'], string> = {
        critical: 'bg-red-500/10 text-red-500 border-red-500/30',
        high: 'bg-grey-100 text-amber border-amber/30',
        medium: 'bg-grey-100 text-amber border-amber/30',
        low: 'bg-card-muted text-foreground-muted border-border',
    };

    const inputCls = 'w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-card focus:outline-none focus:border-purple';
    const caseLink = (c: ShiftCase) => (
        <Link href={`/admin/secops/cases?id=${c.id}`} className="hover:underline hover:text-purple truncate">
            <span className="font-mono text-foreground-muted">{c.number}</span> <span className="text-foreground">{c.title}</span>
        </Link>
    );

    const caseListBody = (list: ShiftCase[], emptyText: string, render: (c: ShiftCase) => React.ReactNode) => {
        if (!rangeValid) return <p className="text-xs text-foreground-muted">Set a valid shift window to see cases.</p>;
        if (casesLoading) return <div className="h-12 bg-card-muted rounded-lg animate-pulse" />;
        if (casesError) return <p className="text-xs text-red-500">Case data unavailable — see the warning above.</p>;
        if (list.length === 0) return <p className="text-xs text-foreground-muted">{emptyText}</p>;
        return <div className="space-y-2">{list.map(render)}</div>;
    };

    const historyPanel = (
        <div className="bg-card border border-border rounded-xl p-4 h-fit">
            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-3">Handover History</p>
            {pastError ? (
                <p className="text-xs text-red-500">Could not load past handovers: {pastError}</p>
            ) : pastLogs === null ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-card-muted rounded animate-pulse" />)}</div>
            ) : pastLogs.length === 0 ? (
                <p className="text-xs text-foreground-muted">No handovers logged yet.</p>
            ) : (
                <div className="space-y-2">
                    {pastLogs.slice(0, 8).map((log) => {
                        const open = expanded === log.id;
                        return (
                            <div key={log.id} className="border border-border rounded-lg">
                                <button onClick={() => setExpanded(open ? null : log.id)} aria-expanded={open} className="w-full text-left p-2.5 flex items-start gap-2">
                                    {open ? <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground-muted" /> : <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground-muted" />}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
                                            <Clock className="w-3 h-3" /> {fmt(Date.parse(log.submittedAt))}
                                        </div>
                                        <p className="text-xs text-foreground mt-0.5">{log.analystOn || '—'} took over from {log.analystOff || '—'}</p>
                                        <p className="text-[10px] text-foreground-muted">{log.casesPending} pending · {log.ongoingCases.length} ongoing case{log.ongoingCases.length === 1 ? '' : 's'}</p>
                                    </div>
                                </button>
                                {open && (
                                    <div className="px-3 pb-3 pt-1 border-t border-border space-y-2.5 text-[11px]">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Shift</p>
                                            <p className="text-foreground">{fmt(Date.parse(log.shiftStart))} → {fmt(Date.parse(log.shiftEnd))}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Going off</p><p className="text-foreground">{log.analystOff || '—'}</p></div>
                                            <div><p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Coming on</p><p className="text-foreground">{log.analystOn || '—'}</p></div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Watch items · {log.watchPriority} priority</p>
                                            <p className="text-foreground whitespace-pre-wrap">{log.watchItems || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Notes</p>
                                            <p className="text-foreground whitespace-pre-wrap">{log.notes || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Critical cases</p>
                                            {log.criticalCases.length === 0 ? <p className="text-foreground-muted">None</p> : <ul className="list-disc pl-4 text-foreground">{log.criticalCases.map((c) => <li key={c}>{c}</li>)}</ul>}
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Ongoing cases</p>
                                            {log.ongoingCases.length === 0 ? <p className="text-foreground-muted">None</p> : <ul className="list-disc pl-4 text-foreground">{log.ongoingCases.map((c) => <li key={c}>{c}</li>)}</ul>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <p className="text-[9px] text-foreground-muted mt-3 pt-3 border-t border-border">Every entry here was written by a confirmed submission from this workflow.</p>
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black text-foreground">Shift Handover</h1>
                    <p className="text-xs text-foreground-muted">Generate, review and confirm a handover — open cases, watch items and notes for whoever comes on next</p>
                </div>
                <button onClick={refresh} className="flex items-center gap-1.5 text-[11px] font-bold text-foreground-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>

            {step === 'done' && justSubmitted ? (
                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-card border border-green/30 rounded-xl p-6 text-center space-y-3">
                        <CheckCircle2 className="w-10 h-10 text-green mx-auto" />
                        <p className="text-sm font-black text-foreground">Handover confirmed and logged</p>
                        <p className="text-xs text-foreground-muted">{justSubmitted.analystOn} is now on shift, taking over from {justSubmitted.analystOff}.</p>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button onClick={() => exportDataAsPDF('Shift Handover', 'shift-handover', buildSections())} className="flex items-center gap-1.5 text-[11px] font-bold text-foreground border border-border rounded-lg px-3 py-1.5">
                                <FileDown className="w-3.5 h-3.5" /> Download PDF
                            </button>
                            <button onClick={startAnother} className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-purple rounded-lg px-3 py-1.5">
                                Start another handover
                            </button>
                        </div>
                    </div>
                    {historyPanel}
                </div>
            ) : step === 'review' ? (
                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                        <button onClick={() => setStep('editing')} className="flex items-center gap-1.5 text-[11px] font-bold text-foreground-muted hover:text-foreground">
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to shift window
                        </button>

                        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Review — Shift Summary</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                <p><span className="text-foreground-muted">Shift:</span> {fmt(startMs)} → {fmt(endMs)}</p>
                                <p><span className="text-foreground-muted">Going off:</span> {analystOff}</p>
                                <p><span className="text-foreground-muted">Coming on:</span> {comingOnName}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                                {[{ label: 'Cases Received', value: received }, { label: 'Cases Resolved', value: resolved, cls: 'text-green' }, { label: 'Cases Pending', value: pending, cls: 'text-amber' }].map((k) => (
                                    <div key={k.label} className="text-center">
                                        <p className={`text-lg font-black ${k.cls ?? 'text-foreground'}`}>{k.value}</p>
                                        <p className="text-[9px] text-foreground-muted uppercase tracking-wider">{k.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-3">Critical Cases This Shift</p>
                            {caseListBody(critical, 'No critical cases this shift.', (c) => (
                                <div key={c.id} className="flex items-center gap-2 text-xs min-w-0">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${SEV_STYLE[c.severity]}`}>{c.severity}</span>
                                    {caseLink(c)}
                                </div>
                            ))}
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-3">Ongoing Cases Requiring Follow-Up</p>
                            {caseListBody(ongoing, 'Nothing carried forward — all cases from this shift are resolved.', (c) => (
                                <div key={c.id} className="flex items-center justify-between gap-2 text-xs min-w-0">
                                    <span className="min-w-0 truncate">{caseLink(c)}</span>
                                    <span className="text-foreground-muted shrink-0">{c.assigned}</span>
                                </div>
                            ))}
                        </div>

                        {/* The editable part of review: watch items + notes */}
                        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Watch Items for Next Shift</p>
                                <div className="flex items-center gap-1">
                                    {WATCH_PRIORITIES.map((p) => (
                                        <button key={p} onClick={() => setWatchPriority(p)} aria-pressed={watchPriority === p}
                                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${watchPriority === p ? (p === 'High' ? 'bg-red-500 text-white' : p === 'Medium' ? 'bg-amber text-white' : 'bg-blue text-white') : 'bg-card-muted text-foreground-muted'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea value={watchItems} onChange={(e) => setWatchItems(e.target.value)} rows={3} aria-label="Watch items"
                                placeholder="e.g. Keep an eye on repeated auth failures — may resume after a quiet period."
                                className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-card resize-none focus:outline-none focus:border-purple" />
                            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Notes</p>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} aria-label="Notes"
                                placeholder="Anything else the next shift should know…"
                                className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-card resize-none focus:outline-none focus:border-purple" />
                        </div>

                        {submitError && (
                            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {submitError}
                            </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => exportDataAsPDF('Shift Handover', 'shift-handover', buildSections())}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-foreground border border-border rounded-lg px-3 py-1.5">
                                <FileDown className="w-3.5 h-3.5" /> Download Draft PDF
                            </button>
                            <button disabled={submitting} onClick={handleSubmit}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-purple rounded-lg px-3 py-1.5 disabled:opacity-50">
                                <Send className="w-3.5 h-3.5" /> {submitting ? 'Confirming…' : 'Confirm & Submit Handover'}
                            </button>
                        </div>
                    </div>
                    {historyPanel}
                </div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                        {casesError && (
                            <div role="alert" className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                                <div>
                                    <p className="font-bold">Unable to load case data — please refresh. You cannot generate a handover until data is confirmed.</p>
                                    <p className="opacity-80 mt-0.5">{casesError}</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                            <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Step 1 — Shift Window</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="ho-start" className="block text-[10px] text-foreground-muted mb-1">Shift Start</label>
                                    <input id="ho-start" type="datetime-local" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label htmlFor="ho-end" className="block text-[10px] text-foreground-muted mb-1">Shift End</label>
                                    <input id="ho-end" type="datetime-local" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} aria-invalid={!rangeValid}
                                        className={`${inputCls} ${rangeValid ? '' : 'border-red-500'}`} />
                                </div>
                                {!rangeValid && <p role="alert" className="sm:col-span-2 text-[11px] font-bold text-red-500 -mt-1">Shift End must be after Shift Start.</p>}
                                <div>
                                    <label htmlFor="ho-off" className="block text-[10px] text-foreground-muted mb-1">Analyst Going Off (you)</label>
                                    <input id="ho-off" value={analystOff} onChange={(e) => setAnalystOff(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label htmlFor="ho-on" className="block text-[10px] text-foreground-muted mb-1">Analyst Coming On</label>
                                    <select id="ho-on" value={comingOn} onChange={(e) => setComingOn(e.target.value)} className={inputCls}>
                                        <option value="">{team === null ? 'Loading team…' : 'Select analyst…'}</option>
                                        {(team ?? []).filter((m) => m.name !== analystOff).map((m) => <option key={m.email} value={m.name}>{m.name}</option>)}
                                        <option value={OTHER}>Other (type a name)…</option>
                                    </select>
                                    {comingOn === OTHER && (
                                        <input value={comingOnOther} onChange={(e) => setComingOnOther(e.target.value)} placeholder="Incoming analyst's name" aria-label="Incoming analyst's name" className={`${inputCls} mt-1.5`} />
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                                {[{ label: 'Cases Received', value: received, cls: 'text-foreground' }, { label: 'Cases Resolved', value: resolved, cls: 'text-green' }, { label: 'Cases Pending', value: pending, cls: 'text-amber' }].map((k) => (
                                    <div key={k.label} className="text-center">
                                        <p className={`text-lg font-black ${k.cls}`}>{dataReady ? k.value : '—'}</p>
                                        <p className="text-[9px] text-foreground-muted uppercase tracking-wider">{k.label}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-foreground-muted">Cases created within the shift window. Auto-closed tier-1 cases are not counted.</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button disabled={!canGenerate} onClick={() => setStep('review')}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-purple rounded-lg px-3 py-1.5 disabled:opacity-50">
                                Generate Handover Draft
                            </button>
                            {!canGenerate && (
                                <span className="text-[10px] text-foreground-muted">
                                    {!rangeValid ? 'Fix the shift window to continue.' : casesError ? 'Case data must load first.' : 'Both analyst names are required.'}
                                </span>
                            )}
                        </div>
                    </div>
                    {historyPanel}
                </div>
            )}
        </div>
    );
}
