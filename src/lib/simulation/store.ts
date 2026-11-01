// NCC SOC — persistence for the shared simulation state. Single JSON file on disk, atomic
// tmp-write + rename, writes serialized through an in-process queue so concurrent requests never
// interleave. This guarantees consistency for a single long-running Node process (the actual
// local/`next start` target for this evaluation build) — it does NOT coordinate across multiple
// server instances or survive an ephemeral/serverless filesystem. That is a known limitation of
// this evaluation deployment, not something this file tries to solve.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildDefaultState } from './scenarios';
import type { SimState } from './types';
import { SIM_STATE_VERSION } from './types';

const DATA_DIR = join(process.cwd(), 'data');
const STATE_FILE = join(DATA_DIR, 'simulation-state.json');
const TMP_FILE = join(DATA_DIR, 'simulation-state.json.tmp');

let cached: SimState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function ensureDataDir(): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Minimal runtime shape guard — enough to catch a corrupt write before it overwrites good state. */
function assertValidState(state: unknown): state is SimState {
    if (!state || typeof state !== 'object') throw new Error('Invalid simulation state: not an object');
    const s = state as Record<string, unknown>;
    const requiredArrays = ['assets', 'findings', 'scans', 'extraTasks', 'organisations', 'users', 'sessions', 'invites', 'auditLog', 'events', 'aiArtifacts'];
    for (const key of requiredArrays) {
        if (!Array.isArray(s[key])) throw new Error(`Invalid simulation state: ${key} must be an array`);
    }
    if (typeof s.version !== 'number') throw new Error('Invalid simulation state: version must be a number');
    if (!s.clock || typeof s.clock !== 'object') throw new Error('Invalid simulation state: clock must be an object');
    return true;
}

function readFromDisk(): SimState | null {
    if (!existsSync(STATE_FILE)) return null;
    try {
        const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
        assertValidState(raw);
        if (raw.version !== SIM_STATE_VERSION) return null; // schema changed — reseed rather than guess a migration
        return raw;
    } catch {
        return null; // corrupt or unreadable — fall back to a fresh seed rather than crashing the server
    }
}

function writeToDisk(state: SimState): void {
    ensureDataDir();
    writeFileSync(TMP_FILE, JSON.stringify(state));
    renameSync(TMP_FILE, STATE_FILE); // atomic on the same filesystem, Windows NTFS and POSIX alike
}

/** Synchronous read of the current state, seeding on first access. */
export function loadState(): SimState {
    if (cached) return cached;
    const fromDisk = readFromDisk();
    if (fromDisk) {
        cached = fromDisk;
        return cached;
    }
    cached = buildDefaultState();
    writeToDisk(cached);
    return cached;
}

/** Apply a mutation and persist it. Serialized so overlapping requests never corrupt the file. */
export function saveState(mutate: (draft: SimState) => void): Promise<SimState> {
    const run = writeQueue.then(() => {
        const draft: SimState = structuredClone(loadState());
        mutate(draft);
        assertValidState(draft);
        writeToDisk(draft);
        cached = draft;
        return draft;
    });
    writeQueue = run.then(() => undefined, () => undefined);
    return run;
}

/** Reseed from scratch — used by the dev-only reset endpoint. */
export function resetState(): SimState {
    cached = buildDefaultState();
    writeToDisk(cached);
    return cached;
}
