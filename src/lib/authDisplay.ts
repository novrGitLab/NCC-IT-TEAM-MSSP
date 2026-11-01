// NCC SOC — display-only hint shown on the login screens. These are NOT read from a server secret
// (auth is server-side now; see src/lib/simulation/scenarios.ts) — they're simply the documented
// fallback values the simulation seeds itself with when SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD are
// left unset in .env.local. If an operator sets those env vars, the real credentials differ from
// this hint — this text exists for a fresh, unconfigured evaluation instance.
export const DEMO_ADMIN_EMAIL = 'admin@ncc-soc.local';
export const DEMO_ADMIN_PASSWORD = 'change-me-now';

export const DEMO_PORTAL_EMAIL = 'client@ncc-soc.demo';
export const DEMO_PORTAL_PASSWORD = 'change-me-now';
