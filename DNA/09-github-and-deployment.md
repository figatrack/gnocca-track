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

### Services Required
1. **Web Service** — Node.js (Express API server)
   - Build command: `pnpm install && pnpm --filter @workspace/api-server run build`
   - Start command: `node artifacts/api-server/dist/index.mjs`
   - Environment: `DATABASE_URL`, `ADMIN_PIN`, `PORT`, `NODE_ENV=production`
2. **Static Site** — Vite build for frontend
   - Build command: `pnpm install && pnpm --filter @workspace/gnocca-track run build`
   - Publish directory: `artifacts/gnocca-track/dist/public`
   - Rewrites: `/* → /index.html`

### Environment Variables for Production
```
DATABASE_URL=<supabase or render postgres connection string>
ADMIN_PIN=<strong private admin PIN>
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://gnoccatrack.com
```

### Render PostgreSQL
Alternatively, use Render's own PostgreSQL addon. Connection string format:
```
postgresql://user:password@host:5432/database
```

### Domain & CORS
Set `CORS_ORIGIN` to the production frontend domain.

### Post-Deploy Verification
1. GET `/api/healthz` → `{ "status": "ok" }`
2. GET `/api/hotspots` → array of hotspots
3. Load frontend → onboarding screen
4. Complete onboarding → map screen with hotspot markers
5. Admin panel at `/admina` → stats visible
