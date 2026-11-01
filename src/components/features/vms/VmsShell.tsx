'use client';

// VMS frame: the section's pages as tabs, and a read-only marker for roles that cannot change
// anything. Scanner Operations shows a notice to roles below manager; its data endpoints refuse
// them too (vms:scope), so this is presentation, not the control. Single-organisation edition —
// no cross-organisation switcher.

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Eye, Lock } from 'lucide-react';
import { vmsLocate } from '@/config/vmsSections';
import { useVmsCan } from './data';
import { EmptyState } from './kit';

export function VmsShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const here = vmsLocate(pathname);
    const can = useVmsCan();
    const gated = here?.section.managerOnly && !can.scope;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
                <nav aria-label={here ? `${here.section.label} pages` : 'VMS pages'} className="flex items-end gap-1 overflow-x-auto scrollbar-none -mb-px min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted pr-3 pb-2.5 whitespace-nowrap">{here?.section.label ?? 'Vulnerability Management'}</span>
                    {here && here.section.pages.length > 1 && here.section.pages.map((p) => {
                        const active = p.href === here.page.href;
                        return (
                            <Link key={p.href} href={p.href} aria-current={active ? 'page' : undefined}
                                className={`text-xs font-semibold px-3 pb-2.5 pt-1 border-b-2 whitespace-nowrap transition-colors ${active ? 'border-purple text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}>{p.label}</Link>
                        );
                    })}
                </nav>
                <div className="flex items-center gap-2 pb-2">
                    {can.readOnly && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-muted bg-card-muted rounded-full px-2.5 py-1"><Eye className="w-3.5 h-3.5" aria-hidden /> Read-only view</span>}
                </div>
            </div>
            {gated
                ? <div className="bg-card border border-border rounded-2xl"><EmptyState icon={Lock} title="Scanner Operations is for SOC managers and super admins" body="Scanner integrations, worker health and scan policies are restricted. The backend refuses these requests for other roles." /></div>
                : children}
        </div>
    );
}
