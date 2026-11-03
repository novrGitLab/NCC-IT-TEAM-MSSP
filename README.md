# NCC IT

Internal security platform with illustrative data. Every alert, asset, finding, case and approval is a
fictional record in a local simulation. No real scanning, monitoring or response action is performed,
and no production system is contacted.

## Layout

```text
NCC IT TEAM MSSP/
├── frontend/   Next.js app: pages, components, route handlers, auth HTTP, middleware, public assets
├── backend/    @ncc-it/backend: simulation state, SOC policy and approvals, reports, contracts
├── docs/       architecture notes
├── scripts/    tests and the navigation check
├── data/       local simulation state (simulation-state.json). Not committed.
└── package.json  npm workspaces (frontend, backend)
```

The Next.js server is the only HTTP server. The backend is an importable package used by the
frontend's route handlers; it does not listen on a port.

## Running it

```powershell
cd "C:\Users\USER\NCC IT TEAM MSSP"
npm install
npm run dev        # development server on http://localhost:3000
```

Production:

```powershell
npm run build
npm run start      # http://localhost:3000
```

Other commands: `npm run typecheck`, `npm test`, `npm run check:nav`.

## Configuration

Local settings live in `frontend/.env` (copy `frontend/.env.example`). The sign-in administrator is
taken from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` when the state is first created. Invitation
email is off unless `BREVO_DELIVERY_ENABLED=true` is set in a production build with a sender configured.

## State persistence

The simulation state is one JSON file, `data/simulation-state.json`, at the workspace root. The
backend finds the workspace root from whatever directory the server runs in, so the same file is used
from the root or from `frontend/`. Set `SIM_DATA_DIR` to use another directory.
