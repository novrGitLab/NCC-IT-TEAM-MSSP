# NCC SOC

A standalone, client-facing demonstration edition of NovrSOC. Frontend-only: every page is served
from local simulated data (`src/lib/demo/`), and nothing in this app calls a production backend,
database, or external security service.

Extracted from NovrSOC's `frontend/` on 2026-10-31.

## Running it

```bash
npm install
cp .env.example .env.local   # then edit the demo credential if you want
npm run dev
```

Open http://localhost:3000.

## What this is not

Not connected to production NovrSOC, Supabase, Wazuh, Greenbone, or MISP. No real scans, no real
alerts, no real data. All figures shown are clearly-labeled demonstration fixtures for the NCC
evaluation.
