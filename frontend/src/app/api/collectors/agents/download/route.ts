import { NextResponse } from 'next/server';
import { requireSession, authErrorResponse } from '@/lib/auth/guard';
import { buildAgentBundle, listAgentPackages, recordAgentDownload } from '@ncc-it/backend/simulation/agent-packages';

/** Downloads every verified endpoint agent package as one .tar with MANIFEST.json (SHA-256) and
 *  INSTALL.txt. The bundle goes to the requesting browser only; nothing is sent to or installed on any
 *  endpoint. With no verified package it answers 409 and lists what is missing. Every attempt is audited. */
export async function POST() {
    try {
        const user = await requireSession(['super_admin', 'soc_manager']);
        const actor = user.name || user.email;
        const bundle = buildAgentBundle();
        if (!bundle) {
            const listing = listAgentPackages();
            const missing = listing.packages.map((p) => ({ id: p.id, file: p.file, reason: p.reason }));
            await recordAgentDownload(actor, 'unavailable', { missing });
            return NextResponse.json({
                error: 'No approved endpoint agent packages are available to download.',
                status: 'unavailable',
                missing,
                artifact_directory: listing.artifactDirectory,
            }, { status: 409 });
        }
        await recordAgentDownload(actor, 'prepared', { file: bundle.fileName, packages: bundle.packages });
        return new NextResponse(new Uint8Array(bundle.data), {
            status: 200,
            headers: {
                'Content-Type': 'application/x-tar',
                'Content-Disposition': `attachment; filename="${bundle.fileName}"`,
                'Cache-Control': 'no-store',
                'X-Agent-Package-Count': String(bundle.packages.length),
            },
        });
    } catch (err) {
        return authErrorResponse(err);
    }
}
