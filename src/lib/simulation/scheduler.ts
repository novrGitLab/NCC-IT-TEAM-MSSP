// NCC SOC — deterministic tick-driven progression. Called on a fixed interval from
// instrumentation.ts (one process-wide tick source, not a per-page setInterval). Each rule reads
// the current tick count, so re-seeding from scratch reproduces the same progression.
import { advanceClock } from './clock';
import { saveState } from './store';
import type { SimState } from './types';

const TICK_MS = 15_000;

function progressScans(draft: SimState): void {
    for (const scan of draft.scans) {
        if (scan.status !== 'running') continue;
        const done = (scan.progress.done ?? 0) + 1;
        const total = scan.progress.total ?? done;
        scan.progress = { ...scan.progress, done: Math.min(done, total) };
        if (done >= total) {
            scan.status = 'succeeded';
            scan.finished_at = new Date().toISOString();
        }
    }
    // Advance one queued scan into running once nothing else is active, so the queue actually moves.
    const anyRunning = draft.scans.some((s) => s.status === 'running');
    if (!anyRunning) {
        const next = draft.scans.find((s) => s.status === 'queued' && !s.attention);
        if (next) {
            next.status = 'running';
            next.started_at = new Date().toISOString();
        }
    }
}

export async function tick(): Promise<void> {
    await advanceClock(TICK_MS);
    await saveState((draft) => { progressScans(draft); });
}

let started = false;

/** Starts the one process-wide tick interval. Safe to call more than once — only the first call
 *  actually starts the timer (relevant under Next.js dev's hot-reload, which can re-run module init). */
export function startScheduler(): void {
    if (started) return;
    started = true;
    setInterval(() => { void tick(); }, TICK_MS);
}
