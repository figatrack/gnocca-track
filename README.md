# GnoccaTrack

GnoccaTrack is a mobile-first nightlife radar PWA. Users tap "Qui Gnocca" to signal venue energy, and those anonymous signals build real-time hotspots on an interactive map.

## Run Locally

- `pnpm install`
- `pnpm --filter @workspace/api-server run dev` - run the API server on `PORT` or `5002`
- `pnpm --filter @workspace/gnocca-track run dev` - run the frontend on `PORT` or `5001`
- `pnpm run typecheck` - full typecheck across packages
- `pnpm run build` - typecheck and build packages
- `pnpm --filter @workspace/api-spec run codegen` - regenerate API hooks and Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` - push DB schema changes in development

Required backend environment:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
ADMIN_PIN=<strong-admin-pin>
```

Optional frontend environment:

```bash
PORT=5001
BASE_PATH=/
API_PROXY_TARGET=http://localhost:5002
```

## Stack

- pnpm workspaces, Node.js 24 target, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion + MapLibre GL JS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval from OpenAPI
- Map tiles: OpenFreeMap
- Venue detection: Overpass API
- Server build: esbuild

## Structure

- `lib/api-spec/openapi.yaml` - OpenAPI contract
- `lib/api-client-react` - generated React Query client
- `lib/api-zod` - generated server-side Zod schemas
- `lib/db/src/schema` - Drizzle schema files
- `artifacts/api-server` - Express backend
- `artifacts/gnocca-track` - React/Vite PWA
- `artifacts/mockup-sandbox` - component preview sandbox
- `DNA` - project documentation

## Product Notes

- Anonymous identity uses `deviceId`, nickname, and PIN hash.
- Hotspot intensity is computed from `clickCount`.
- Seed hotspots use `is_seed=true` and `expires_at=NULL`.
- The frontend calls `/api/*`; in local development Vite proxies those calls to `API_PROXY_TARGET`.
- The admin panel canonical route is `/admina`.
- The admin API requires the `x-admin-pin` header and `ADMIN_PIN` on the server.
