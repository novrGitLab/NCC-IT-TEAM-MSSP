// Next.js convention: register() runs once when the server process starts. Used here to start the
// simulation's single tick source instead of per-page setInterval timers.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startScheduler } = await import('./src/lib/simulation/scheduler');
        startScheduler();
    }
}
