import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/simulation/auth/guard';
import { getOrganisation, updateOrganisation } from '@/lib/simulation/engine';
import type { OrgFramework } from '@/lib/simulation/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession(['super_admin', 'soc_manager', 'executive']);
        const { id } = await params;
        if (!getOrganisation(id)) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

        const body = await req.json().catch(() => ({}));
        const frameworks: OrgFramework[] = Array.isArray(body.frameworks)
            ? body.frameworks.map((f: Record<string, unknown>) => ({ framework: String(f.framework ?? ''), enabled: !!f.enabled, initialScore: Number(f.initialScore ?? 0) }))
            : [];
        const contacts = body.contacts ?? {};

        await updateOrganisation(id, {
            frameworks,
            cisoName: typeof contacts.cisoName === 'string' ? contacts.cisoName : undefined,
            cisoEmail: typeof contacts.cisoEmail === 'string' ? contacts.cisoEmail : undefined,
            wazuh_group: typeof body.wazuhGroup === 'string' ? body.wazuhGroup : undefined,
        });
        return NextResponse.json({ ok: true, message: 'Compliance baseline recorded and persisted.' });
    } catch (err) {
        return authErrorResponse(err);
    }
}
