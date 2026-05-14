# GnoccaTrack — GitHub & Deployment

## GitHub Governance

### Branch Strategy
- `main` — production-ready code only
- `dev` — active development
- `feature/*` — individual features
- `fix/*` — bug fixes

### Commit Rules
- Commits in English
- Format: `type(scope): description`
  - `feat(map): add hotspot popup on click`
  - `fix(clicks): handle cooldown edge case`
  - `chore(deps): update maplibre-gl`
- No commits with: broken build, console.log in server code, TODOs without issues

### Pre-Push Checklist
```bash
pnpm run typecheck          # must pass
pnpm --filter @workspace/api-server run build  # must succeed
# manual test: onboarding flow
# manual test: Qui Gnocca button
# manual test: hotspot appears on map
# manual test: admin panel access at /admina
```

### What Must NOT Be Committed
- Supabase keys or any `.env` with real secrets
- `node_modules/`
- `dist/` or `build/` output folders
- Any file containing real user data

## Deployment (Render)

### Service Required
Use a single **Web Service**. The Express API serves `/api/*` and also serves the Vite frontend build for every non-API route.

- Build command: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @workspace/gnocca-track run build && corepack pnpm --filter @workspace/api-server run build`
- Start command: `corepack pnpm --filter @workspace/api-server run start`
- Health check path: `/api/healthz`
- Environment: `DATABASE_URL`, `ADMIN_PIN`, `NODE_ENV=production`, `NODE_VERSION=24.14.1`

Do not use `corepack enable` on Render: the system package-manager shim directory can be read-only.

### Environment Variables for Production
```
DATABASE_URL=<supabase or render postgres connection string>
ADMIN_PIN=<strong private admin PIN>
NODE_ENV=production
NODE_VERSION=24.14.1
```

### Render PostgreSQL
Alternatively, use Render's own PostgreSQL addon. Connection string format:
```
postgresql://user:password@host:5432/database
```

### Domain & CORS
For the single-service deployment, `CORS_ORIGIN` can be omitted because frontend and API share the same origin.

### Post-Deploy Verification
1. GET `/api/healthz` → `{ "status": "ok" }`
2. GET `/api/hotspots` → array of hotspots
3. Load frontend → onboarding screen
4. Complete onboarding → map screen with hotspot markers
5. Admin panel at `/admina` → stats visible
