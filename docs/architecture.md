# Architecture

## Packages

- **frontend** (`@ncc-it/frontend`): the Next.js application. Owns pages, React components, client
  state, styles, route handlers under `src/app/api`, sign-in cookies (`src/lib/auth/guard.ts`), the
  SOC HTTP error mapping (`src/lib/server/soc-http.ts`), middleware and public assets.
- **backend** (`@ncc-it/backend`): server-side domain code, imported by the frontend route handlers.
  Holds the simulation state store, the engine, the SOC policy and runtime, the SOC record stores,
  approvals, reports, insights, the remediation planner, the AI analyst, invitations and contracts
  (`src/contracts`) shared with the browser as types and pure helpers.

## Rules

- The backend never imports Next.js, React, or frontend modules.
- The frontend imports the backend by package name (`@ncc-it/backend/simulation/...`), never by a
  relative path into `backend/`.
- The state file lives under the workspace root's `data/` folder, found from the start directory.

## Request flow

Browser → Next.js route handler (`frontend/src/app/api/**`) → guard (`requireSession`) → backend
function (`@ncc-it/backend/simulation/...`) → state store (`data/simulation-state.json`).
