# GnoccaTrack — Supabase Setup Guide

## Overview

GnoccaTrack uses a standard PostgreSQL database via Drizzle ORM. The schema maps 1:1 to Supabase tables. To migrate from a local/Render Postgres instance to Supabase:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the full SQL in `DNA/10-supabase-sql-scripts.md` in the Supabase SQL Editor (Steps 1–13)
3. Set `DATABASE_URL` to the Supabase connection string (see below)
4. Deploy the unified Render Web Service with the new DATABASE_URL secret

## Connection String

**Development (direct, port 5432):**
```
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Production on Render (pooled, port 6543, Transaction mode):**
```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgmode=transaction
```

Find both strings at: Supabase Dashboard → Settings → Database → Connection String.

> **IMPORTANT:** Use the **service role** connection (postgres user), not the anon connection. Never expose the service role key on the frontend.

## Environment Variables

| Variable | Where to set | Notes |
|---|---|---|
| `DATABASE_URL` | Local `.env` + production env | Postgres connection string |
| `ADMIN_PIN` | Local `.env` + production env | Server-side admin PIN |

## Schema Summary

The full SQL setup is in `DNA/10-supabase-sql-scripts.md`. The 4 tables are:

| Table | Description |
|---|---|
| `users` | Anonymous accounts — device_id + nickname + pin_hash |
| `hotspots` | Map hotspots — lat/lng, intensity, click_count, is_seed |
| `clicks` | Click events — device_id, hotspot_id, venue_name |
| `admin_config` | Singleton config — durations, radii, button text |

### Key constraints
- `users.device_id` — UNIQUE (one account per device)
- `users.nickname` — UNIQUE (no duplicate names)
- `clicks.hotspot_id` — FK → `hotspots.id` ON DELETE CASCADE
- `hotspots.expires_at = NULL` — seed hotspots never expire

### Intensity rules (computed dynamically)
| click_count | intensity |
|---|---|
| 0–3 | low |
| 4–9 | medium |
| 10–19 | high |
| 20+ | bomb |

## Row Level Security

All tables use RLS with service_role bypass. Public clients never hit the DB directly — all access is through the Express API which connects with the postgres service role.

See Step 6 in `DNA/10-supabase-sql-scripts.md` for full RLS policies.

## Render Deployment

1. Create a new Web Service on [render.com](https://render.com)
2. Connect the GitHub repo
3. Set build command: `pnpm run build`
4. Set start command: `node artifacts/api-server/dist/index.mjs`
5. Add env vars: `DATABASE_URL`, `ADMIN_PIN`, `NODE_ENV=production`, `PORT=10000`
6. Keep a single Web Service: Express serves `/api/*` and the built Vite frontend

See `DNA/09-github-and-deployment.md` for full deployment steps.
