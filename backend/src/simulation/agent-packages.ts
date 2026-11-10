// Endpoint collector package availability. A package is offered only when all of these hold:
//   - backend/artifacts/agents/manifest.json exists and lists the package with a SHA-256 value;
//   - the file exists in backend/artifacts/agents/;
//   - the file's SHA-256 matches the manifest.
// Anything else is reported as unavailable with the reason, so nothing is offered that cannot be verified.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_PACKAGE_TARGETS, type AgentPackageTarget } from '../contracts/agent-packages';
import { saveState, workspaceRoot } from './store';

export interface AgentPackageStatus {
    id: string;
    name: string;
    os: string;
    arch: string;
    file: string;
    version: string | null;
    sha256: string | null;
    available: boolean;
    reason: string | null;
}

interface ManifestEntry { id: string; file: string; version: string; sha256: string }

const ARTIFACT_DIR = () => join(workspaceRoot(process.cwd()), 'backend', 'artifacts', 'agents');

function readManifest(dir: string): { entries: ManifestEntry[] } | { error: string } {
    const path = join(dir, 'manifest.json');
    if (!existsSync(path)) return { error: 'No approved manifest has been staged.' };
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (!Array.isArray(parsed?.packages)) return { error: 'The manifest has no package list.' };
        return { entries: parsed.packages as ManifestEntry[] };
    } catch {
        return { error: 'The manifest could not be read.' };
    }
}

function sha256Of(path: string): string {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function statusFor(target: AgentPackageTarget, dir: string, manifest: ReturnType<typeof readManifest>): AgentPackageStatus {
    const base = { id: target.id, name: target.name, os: target.os, arch: target.arch, file: target.file, version: null, sha256: null };
    if ('error' in manifest) return { ...base, available: false, reason: manifest.error };
    const entry = manifest.entries.find((e) => e.id === target.id && e.file === target.file);
    if (!entry || !entry.sha256) return { ...base, available: false, reason: 'Not listed in the approved manifest, or no checksum recorded.' };
    const path = join(dir, target.file);
    if (!existsSync(path) || !statSync(path).isFile()) return { ...base, version: entry.version, sha256: entry.sha256, available: false, reason: 'The approved file is missing.' };
    if (sha256Of(path) !== entry.sha256) return { ...base, version: entry.version, sha256: entry.sha256, available: false, reason: 'The file does not match its recorded SHA-256; it was not offered.' };
    return { ...base, version: entry.version, sha256: entry.sha256, available: true, reason: null };
}

export function listAgentPackages(): { packages: AgentPackageStatus[]; availableCount: number; artifactDirectory: string } {
    const dir = ARTIFACT_DIR();
    const manifest = readManifest(dir);
    const packages = AGENT_PACKAGE_TARGETS.map((t) => statusFor(t, dir, manifest));
    return { packages, availableCount: packages.filter((p) => p.available).length, artifactDirectory: 'backend/artifacts/agents' };
}

/** Records a download request and its outcome in the audit log. */
export async function recordAgentDownload(actor: string, outcome: 'unavailable' | 'prepared', detail: Record<string, unknown>): Promise<void> {
    await saveState((draft) => {
        draft.auditLog.push({ id: `audit-${randomUUID()}`, at: new Date().toISOString(), actor, action: `collector.agent_download_${outcome}`, details: detail });
    });
}

/** One 512-byte POSIX ustar header. Names are ASCII package file names from the fixed target list. */
function tarHeader(name: string, size: number, mtimeMs: number): Buffer {
    const h = Buffer.alloc(512);
    h.write(name, 0, 100, 'ascii');
    h.write('0000644\0', 100, 'ascii');
    h.write('0000000\0', 108, 'ascii');
    h.write('0000000\0', 116, 'ascii');
    h.write(size.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
    h.write(Math.floor(mtimeMs / 1000).toString(8).padStart(11, '0') + '\0', 136, 'ascii');
    h.fill(0x20, 148, 156);
    h.write('0', 156, 'ascii');
    h.write('ustar\0', 257, 'ascii');
    h.write('00', 263, 'ascii');
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
    return h;
}

function tarEntry(name: string, data: Buffer, mtimeMs: number): Buffer[] {
    const pad = (512 - (data.length % 512)) % 512;
    return [tarHeader(name, data.length, mtimeMs), data, Buffer.alloc(pad)];
}

export interface AgentBundle { fileName: string; data: Buffer; packages: { id: string; file: string; version: string; sha256: string }[] }

/** A .tar of every verified package, re-checked at build time, plus MANIFEST.json and INSTALL.txt.
 *  Returns null when no package is verified. Nothing is sent to or installed on any endpoint. */
export function buildAgentBundle(now = Date.now()): AgentBundle | null {
    const dir = ARTIFACT_DIR();
    const listing = listAgentPackages();
    const ready = listing.packages.filter((p) => p.available);
    if (ready.length === 0) return null;
    const parts: Buffer[] = [];
    const included: AgentBundle['packages'] = [];
    for (const p of ready) {
        const data = readFileSync(join(dir, p.file));
        const sha = createHash('sha256').update(data).digest('hex');
        if (sha !== p.sha256) continue;
        parts.push(...tarEntry(p.file, data, now));
        included.push({ id: p.id, file: p.file, version: p.version as string, sha256: sha });
    }
    if (included.length === 0) return null;
    const manifest = {
        generated_at: new Date(now).toISOString(),
        packages: included.map((p) => {
            const t = listing.packages.find((x) => x.id === p.id)!;
            return { ...p, os: t.os, arch: t.arch };
        }),
    };
    const install = [
        'NCC IT endpoint collector packages',
        '',
        'This bundle was downloaded to the browser that requested it. Nothing has been installed on any endpoint.',
        '1. Copy this .tar file to the endpoint collector host through your approved transfer method.',
        '2. Extract it there, then check each file against MANIFEST.json, for example:',
        '     sha256sum <file>                 (Linux)',
        '     Get-FileHash <file> -Algorithm SHA256   (Windows PowerShell)',
        '3. Install only packages whose SHA-256 matches MANIFEST.json, following your change process.',
        '',
    ].join('\n');
    parts.push(...tarEntry('MANIFEST.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), now));
    parts.push(...tarEntry('INSTALL.txt', Buffer.from(install), now));
    parts.push(Buffer.alloc(1024));
    const stamp = new Date(now).toISOString().slice(0, 10);
    return { fileName: `ncc-endpoint-agents-${stamp}.tar`, data: Buffer.concat(parts), packages: included };
}
