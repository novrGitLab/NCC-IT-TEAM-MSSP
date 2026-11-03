import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { createOrganisation, listOrganisations } from '@ncc-it/backend/simulation/engine';

export async function GET() {
    try {
        await requireSession();
        return NextResponse.json({ organisations: listOrganisations() });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireSession(['super_admin', 'soc_manager', 'executive']);
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? '').trim();
        const domain = String(body.domain ?? '').trim();
        if (!name || !domain) return NextResponse.json({ error: 'name and domain are required' }, { status: 400 });

        const org = await createOrganisation({
            name, domain, industry: body.industry, plan: body.plan, country: body.country, address: body.address,
            contactName: body.contact_name, contactEmail: body.contact_email, contactPhone: body.contact_phone,
            cisoName: body.ciso_name, cisoEmail: body.ciso_email,
            businessUnits: Array.isArray(body.business_units) ? body.business_units.map(String) : undefined,
        });
        return NextResponse.json(org, { status: 201 });
    } catch (err) {
        return authErrorResponse(err);
    }
}
