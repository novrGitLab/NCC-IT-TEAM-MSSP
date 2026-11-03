// NCC IT — single authoritative simulation clock. Advanced only by scheduler.tick(), called once
// per interval from instrumentation.ts — not by per-page timers pretending to be data sources.
import { saveState } from './store';
import { runSocPolicy } from './soc-runtime';

export async function advanceClock(deltaMs: number): Promise<void> {
    await saveState((draft) => {
        draft.clock.tickCount += 1;
        draft.clock.nowIso = new Date(Date.parse(draft.clock.nowIso) + deltaMs * draft.clock.speedMultiplier).toISOString();
        runSocPolicy(draft, Date.parse(draft.clock.nowIso));
    });
}
