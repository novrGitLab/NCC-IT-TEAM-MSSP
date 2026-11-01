// NCC SOC — persistence for the shared simulation state. Single JSON file on disk, atomic
// tmp-write + rename, writes serialized through an in-process queue so concurrent requests never
// interleave. This guarantees consistency for a single long-running Node process (the actual
// local/`next start` target for this evaluation build) — it does NOT coordinate across multiple
// server instances or survive an ephemeral/serverless filesystem. That is a known limitation of
// this evaluation deployment, not something this file tries to solve.
//
// The in-memory cache lives on `globalThis`, not a plain module-level variable — Next.js's dev
// server (and instrumentation.ts specifically, which runs in a separate compilation layer from
// route handlers) can load this file as more than one module instance within the same process.
// A plain `let cached` would then give the scheduler and the route handlers each their own
// snapshot, silently diverging (confirmed live: the scheduler kept ticking a stale pre-creation
// snapshot and overwriting newer collectors' progress on disk every tick). `globalThis` is the
// one thing every module instance in the same process actually shares.
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { buildDefaultState } from './scenarios';
import type { SimState } from './types';
import { SIM_STATE_VERSION } from './types';

// SIM_DATA_DIR lets a one-off verification/test process point at its own scratch directory
// instead of the real data/ dir a long-running dev or prod server already owns — otherwise two
// server processes started against the same project directory would fight over one file. Unset
// in normal use; defaults to data/ under the project root exactly as before.
const DATA_DIR = process.env.SIM_DATA_DIR
    ? (isAbsolute(process.env.SIM_DATA_DIR) ? process.env.SIM_DATA_DIR : resolve(process.cwd(), process.env.SIM_DATA_DIR))
    : join(process.cwd(), 'data');
const STATE_FILE = join(DATA_DIR, 'simulation-state.json');
const TMP_FILE = join(DATA_DIR, 'simulation-state.json.tmp');

interface GlobalCache { cached: SimState | null; cachedMtimeMs: number; writeQueue: Promise<void> }
const g = globalThis as typeof globalThis & { __nccSocSimStore?: GlobalCache };
const store: GlobalCache = g.__nccSocSimStore ?? (g.__nccSocSimStore = { cached: null, cachedMtimeMs: 0, writeQueue: Promise.resolve() });

function ensureDataDir(): void {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Minimal runtime shape guard — enough to catch a corrupt write before it overwrites good state. */
function assertValidState(state: unknown): state is SimState {
    if (!state || typeof state !== 'object') throw new Error('Invalid simulation state: not an object');
    const s = state as Record<string, unknown>;
    const requiredArrays = ['assets', 'findings', 'scans', 'extraTasks', 'organisations', 'collectors', 'ingestionEvents', 'postureEvents', 'users', 'sessions', 'invites', 'auditLog', 'events', 'aiArtifacts'];
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

function writeToDisk(state: SimState): number {
    ensureDataDir();
    writeFileSync(TMP_FILE, JSON.stringify(state));
    renameSync(TMP_FILE, STATE_FILE); // atomic on the same filesystem, Windows NTFS and POSIX alike
    return statSync(STATE_FILE).mtimeMs;
}

/** Synchronous read of the current state, seeding on first access. Re-reads from disk whenever
 *  the file's mtime has moved past what this cache last saw — the defensive half of the
 *  globalThis fix above, covering any write that didn't go through this exact module instance's
 *  saveState() (e.g. a differently-bundled instance, or a future out-of-process writer). */
export function loadState(): SimState {
    if (store.cached && existsSync(STATE_FILE) && statSync(STATE_FILE).mtimeMs <= store.cachedMtimeMs) return store.cached;
    const fromDisk = readFromDisk();
    if (fromDisk) {
        store.cached = fromDisk;
        store.cachedMtimeMs = statSync(STATE_FILE).mtimeMs;
        return store.cached;
    }
    if (store.cached) return store.cached; // disk unreadable/missing right now — keep serving the last good state
    store.cached = buildDefaultState();
    store.cachedMtimeMs = writeToDisk(store.cached);
    return store.cached;
}

/** Apply a mutation and persist it. Serialized so overlapping requests never corrupt the file. */
export function saveState(mutate: (draft: SimState) => void): Promise<SimState> {
    const run = store.writeQueue.then(() => {
        const draft: SimState = structuredClone(loadState());
        mutate(draft);
        assertValidState(draft);
        store.cachedMtimeMs = writeToDisk(draft);
        store.cached = draft;
        return draft;
    });
    store.writeQueue = run.then(() => undefined, () => undefined);
    return run;
}

/** Reseed from scratch — used by the dev-only reset endpoint. */
export function resetState(): SimState {
    store.cached = buildDefaultState();
    store.cachedMtimeMs = writeToDisk(store.cached);
    return store.cached;
}
