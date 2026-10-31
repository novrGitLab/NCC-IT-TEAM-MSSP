'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPortalContext } from '@/lib/portal-context';
import { apiUrl, apiFetch } from '@/lib/api';

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'] as const;
type RecordType = typeof RECORD_TYPES[number];

interface SimpleRecord { name: string; ttl: number; data: string; }
interface MxRecord { name: string; ttl: number; priority: number; exchange: string; }
interface TxtRecord { name: string; ttl: number; value: string; }
interface SoaRecord { name: string; ttl: number; mname: string; rname: string; serial: string; refresh: string; retry: string; expire: string; minimum: string; }

interface DnsRecordSet {
    A: SimpleRecord[];
    AAAA: SimpleRecord[];
    MX: MxRecord[];
    TXT: TxtRecord[];
    NS: SimpleRecord[];
    CNAME: SimpleRecord[];
    SOA: SoaRecord[];
}

interface CertEntry {
    issuer: string;
    common_name: string;
    san: string[];
    not_before: string;
    not_after: string;
    expired: boolean;
}

interface DnsLookupResult {
    domain: string;
    records: DnsRecordSet;
    certificates: CertEntry[];
    summary: {
        total_records: number;
        total_certs: number;
        expired_certs: number;
        expiring_soon: number;
    };
}

const RECENT_KEY = 'dns-suite-recent-searches';

function loadRecent(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveRecent(domain: string) {
    const current = loadRecent().filter((d) => d !== domain);
    const next = [domain, ...current].slice(0, 5);
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
        // localStorage unavailable — recent searches just won't persist.
    }
}

function certStatus(cert: CertEntry): { label: string; emoji: string; style: string } {
    if (cert.expired) return { label: 'Expired', emoji: '🔴', style: 'bg-red-500/10 text-red-500 border-red-500/30' };
    const daysLeft = (new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 30) return { label: 'Expiring Soon', emoji: '🟡', style: 'bg-grey-100 text-amber border-amber/30' };
    return { label: 'Valid', emoji: '🟢', style: 'bg-blue/10 text-blue border-blue/30' };
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface SecurityCheck { label: string; passed: boolean; points: number; }

function computeSecurityScore(records: DnsRecordSet, certificates: CertEntry[]): { score: number; checks: SecurityCheck[] } {
    const txtValues = records.TXT.map((t) => t.value.toLowerCase());
    const hasMx = records.MX.length > 0;
    const hasSpf = txtValues.some((v) => v.startsWith('v=spf1'));
    const hasDmarc = txtValues.some((v) => v.startsWith('v=dmarc1')) || records.TXT.some((t) => t.name.startsWith('_dmarc'));
    const hasDkim = txtValues.some((v) => v.includes('dkim')) || records.TXT.some((t) => t.name.includes('_domainkey'));
    const hasValidCert = certificates.some((c) => !c.expired);
    const noExpiredCerts = certificates.length > 0 && certificates.every((c) => !c.expired);

    const checks: SecurityCheck[] = [
        { label: 'Has MX records', passed: hasMx, points: 10 },
        { label: 'Has SPF record', passed: hasSpf, points: 20 },
        { label: 'Has DMARC record', passed: hasDmarc, points: 20 },
        { label: 'Has DKIM record', passed: hasDkim, points: 15 },
        { label: 'Has valid HTTPS certificate', passed: hasValidCert, points: 20 },
        { label: 'No expired certificates', passed: noExpiredCerts, points: 15 },
    ];

    const score = checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0);
    return { score, checks };
}

function scoreLabel(score: number): { label: string; style: string } {
    if (score >= 80) return { label: 'Secure', style: 'text-blue' };
    if (score >= 50) return { label: 'Moderate', style: 'text-amber' };
    return { label: 'At Risk', style: 'text-red-500' };
}

const EMPTY_RECORDS: DnsRecordSet = { A: [], AAAA: [], MX: [], TXT: [], NS: [], CNAME: [], SOA: [] };

export function DnsSuite() {
    return (
        <Suspense fallback={null}>
            <DNSPageContent />
        </Suspense>
    );
}

function DNSPageContent() {
    const searchParams = useSearchParams();
    const [domain, setDomain] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<Set<RecordType>>(new Set(RECORD_TYPES));
    const [activeTab, setActiveTab] = useState<RecordType>('A');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DnsLookupResult | null>(null);
    const [recent, setRecent] = useState<string[]>([]);
    const autoRan = useRef(false);

    useEffect(() => setRecent(loadRecent()), []);

    useEffect(() => {
        const queryDomain = searchParams.get('domain');
        if (queryDomain && !autoRan.current) {
            autoRan.current = true;
            setDomain(queryDomain);
            analyse(queryDomain);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const toggleType = (type: RecordType) => {
        setSelectedTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    };

    const analyse = async (domainOverride?: string) => {
        const target = (domainOverride ?? domain).trim();
        if (!target) return;
        setLoading(true);
        setError(null);
        try {
            const orgId = getPortalContext().orgId;
            const res = await apiFetch(apiUrl('/api/dns/lookup'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: target, record_types: Array.from(selectedTypes), ...(orgId ? { orgId } : {}) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'DNS lookup failed');
            setResult(data);
            setDomain(target);
            saveRecent(target);
            setRecent(loadRecent());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'DNS lookup failed');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const records = result?.records ?? EMPTY_RECORDS;
    const { score, checks } = result ? computeSecurityScore(records, result.certificates) : { score: 0, checks: [] };
    const scoreInfo = scoreLabel(score);

    const activeRows = records[activeTab] ?? [];

    return (
            <div className="space-y-4">
                <div>
                    <h1 className="text-lg font-black text-foreground">DNS Intelligence Suite</h1>
                    <p className="text-xs text-foreground-muted">DNS records, certificate monitoring, and domain analysis</p>
                </div>

                {/* Search bar */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="h-[3px] bg-blue from-blue via-blue to-red-500" />
                    <div className="p-5">
                        <div className="flex gap-3">
                            <input
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && analyse()}
                                placeholder="Enter domain name (e.g. novasoc-ncc.local)"
                                className="flex-1 bg-card-muted border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
                            />
                            <button
                                onClick={() => analyse()}
                                disabled={loading || !domain.trim()}
                                className="px-6 py-2.5 bg-orange hover:bg-orange-hover disabled:opacity-60 text-white text-xs font-black rounded-lg transition-colors whitespace-nowrap"
                            >
                                {loading ? '⏳ Analysing…' : 'Analyse Domain'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3">
                            {RECORD_TYPES.map((type) => (
                                <label key={type} className="flex items-center gap-1.5 text-[11px] font-bold text-foreground-muted cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTypes.has(type)}
                                        onChange={() => toggleType(type)}
                                        className="rounded border-border"
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                        {recent.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {recent.map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => { setDomain(d); analyse(d); }}
                                        className="text-[10px] font-bold px-2.5 py-1 bg-card-muted text-foreground-muted border border-border rounded-full hover:bg-card-muted transition-colors"
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        )}
                        {error && <p className="text-[11px] text-red-500 mt-3">{error}</p>}
                    </div>
                </div>

                {result && (
                    <>
                        {/* DNS Records */}
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className="h-[3px] bg-blue from-blue via-blue to-red-500" />
                            <div className="px-4 pt-3 flex gap-1 border-b border-border overflow-x-auto">
                                {RECORD_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setActiveTab(type)}
                                        className={`px-3 py-2 text-[11px] font-bold rounded-t-lg transition-colors whitespace-nowrap ${
                                            activeTab === type ? 'bg-card-muted text-blue border-x border-t border-border' : 'text-foreground-muted hover:text-foreground-muted'
                                        }`}
                                    >
                                        {type} ({records[type]?.length ?? 0})
                                    </button>
                                ))}
                            </div>
                            <div className="p-4">
                                {activeRows.length === 0 ? (
                                    <p className="text-xs text-foreground-muted text-center py-8">No {activeTab} records found</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    {activeTab === 'MX' && ['Name', 'Priority', 'Exchange', 'TTL'].map((h) => (
                                                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{h}</th>
                                                    ))}
                                                    {activeTab === 'TXT' && ['Name', 'Value', 'TTL'].map((h) => (
                                                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{h}</th>
                                                    ))}
                                                    {activeTab === 'SOA' && ['Primary NS', 'Admin', 'Serial', 'Refresh', 'Retry', 'Expire', 'Minimum'].map((h) => (
                                                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{h}</th>
                                                    ))}
                                                    {['A', 'AAAA', 'NS', 'CNAME'].includes(activeTab) && ['Name', 'Value', 'TTL'].map((h) => (
                                                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeTab === 'MX' && (records.MX as MxRecord[]).map((r, i) => (
                                                    <tr key={i} className="border-b border-border">
                                                        <td className="px-3 py-2 font-mono text-foreground-muted">{r.name}</td>
                                                        <td className="px-3 py-2 font-bold text-foreground">{r.priority}</td>
                                                        <td className="px-3 py-2 font-mono text-foreground-muted">{r.exchange}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.ttl}</td>
                                                    </tr>
                                                ))}
                                                {activeTab === 'TXT' && (records.TXT as TxtRecord[]).map((r, i) => (
                                                    <tr key={i} className="border-b border-border">
                                                        <td className="px-3 py-2 font-mono text-foreground-muted whitespace-nowrap">{r.name}</td>
                                                        <td className="px-3 py-2 font-mono text-foreground-muted break-all max-w-[420px]">{r.value}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.ttl}</td>
                                                    </tr>
                                                ))}
                                                {activeTab === 'SOA' && (records.SOA as SoaRecord[]).map((r, i) => (
                                                    <tr key={i} className="border-b border-border">
                                                        <td className="px-3 py-2 font-mono text-foreground-muted">{r.mname}</td>
                                                        <td className="px-3 py-2 font-mono text-foreground-muted">{r.rname}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.serial}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.refresh}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.retry}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.expire}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.minimum}</td>
                                                    </tr>
                                                ))}
                                                {['A', 'AAAA', 'NS', 'CNAME'].includes(activeTab) && (records[activeTab] as SimpleRecord[]).map((r, i) => (
                                                    <tr key={i} className="border-b border-border">
                                                        <td className="px-3 py-2 font-mono text-foreground-muted whitespace-nowrap">{r.name}</td>
                                                        <td className="px-3 py-2 font-mono text-foreground">{r.data}</td>
                                                        <td className="px-3 py-2 text-foreground-muted">{r.ttl}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SSL Certificates */}
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className="h-[3px] bg-blue from-blue via-blue to-red-500" />
                            <div className="p-4 border-b border-border">
                                <p className="text-xs font-black text-foreground">Certificate Transparency</p>
                                <p className="text-[10px] text-foreground-muted mt-0.5">
                                    {result.summary.total_certs} certificates found · {result.summary.expired_certs} expired · {result.summary.expiring_soon} expiring within 30 days
                                </p>
                            </div>
                            {result.certificates.length === 0 ? (
                                <p className="text-xs text-foreground-muted text-center py-8">No certificates found in Certificate Transparency logs</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border">
                                                {['Common Name', 'Issuer', 'Valid From', 'Expires', 'Status'].map((h) => (
                                                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-foreground-muted uppercase tracking-wider">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.certificates.map((cert, i) => {
                                                const status = certStatus(cert);
                                                return (
                                                    <tr key={i} className="border-b border-border hover:bg-card-muted">
                                                        <td className="px-4 py-2.5 font-mono text-foreground">{cert.common_name}</td>
                                                        <td className="px-4 py-2.5 text-foreground-muted max-w-[240px] truncate">{cert.issuer}</td>
                                                        <td className="px-4 py-2.5 text-foreground-muted whitespace-nowrap">{formatDate(cert.not_before)}</td>
                                                        <td className="px-4 py-2.5 text-foreground-muted whitespace-nowrap">{formatDate(cert.not_after)}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${status.style}`}>{status.emoji} {status.label}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Domain Security Score */}
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className={`h-[3px] ${score >= 80 ? 'bg-blue from-blue to-blue' : score >= 50 ? 'bg-blue from-amber to-amber' : 'bg-blue from-red-500 to-red-500'}`} />
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-black text-foreground">Domain Security Score</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-black text-foreground">{score}/100</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${scoreInfo.style} bg-opacity-10`}>{scoreInfo.label}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {checks.map((c) => (
                                        <div key={c.label} className="flex items-center justify-between text-[11px] border-b border-border pb-1.5">
                                            <span className="flex items-center gap-2 text-foreground-muted">
                                                <span>{c.passed ? '✅' : '❌'}</span>
                                                {c.label}
                                            </span>
                                            <span className={`font-bold ${c.passed ? 'text-blue' : 'text-border'}`}>+{c.points}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
    );
}
