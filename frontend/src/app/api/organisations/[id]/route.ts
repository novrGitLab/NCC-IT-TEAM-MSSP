import { NextRequest, NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { getOrganisation, updateOrganisation } from '@ncc-it/backend/simulation/engine';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession();
        const { id } = await params;
        const org = getOrganisation(id);
        return org ? NextResponse.json(org) : NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    } catch (err) {
        return authErrorResponse(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireSession(['super_admin', 'soc_manager', 'executive']);
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};
        if (typeof body.wazuh_group === 'string' || body.wazuh_group === null) patch.wazuh_group = body.wazuh_group ?? undefined;
        if (typeof body.setup_complete === 'boolean') patch.onboardingComplete = body.setup_complete;
        if (typeof body.onboarding_step === 'number') patch.onboardingStep = body.onboarding_step;
        if (Array.isArray(body.business_units)) patch.businessUnits = body.business_units.map(String);
        if (Array.isArray(body.infrastructure_categories)) patch.infrastructureCategories = body.infrastructure_categories.map(String);

        const org = await updateOrganisation(id, patch);
        return org ? NextResponse.json(org) : NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    } catch (err) {
        return authErrorResponse(err);
    }
}
