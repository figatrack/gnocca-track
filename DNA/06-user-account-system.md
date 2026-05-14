# GnoccaTrack — Anonymous User Account System

## Philosophy

No real personal data. No email. No phone. No tracking. The app is usable anonymously and frictionlessly.

## Account Components

| Component | Storage | Description |
|---|---|---|
| `deviceId` | localStorage (`gt_device_id`) | UUID generated on first app open |
| `nickname` | localStorage + server DB | Chosen by user during onboarding (2–20 chars) |
| `pin` | Only hash on server | 4-digit numeric PIN |
| `pinHash` | PostgreSQL `users.pin_hash` | scrypt hash with per-user random salt |

## Onboarding Flow

1. App detects no stored user → redirect to `/onboarding`
2. Step 1: User enters nickname
3. Step 2: User enters 4-digit PIN (iOS-style digit inputs)
4. POST `/api/users` with `{ deviceId, nickname, pin }`
5. Server creates user, returns user object
6. Client stores `{ deviceId, nickname }` in localStorage
7. Redirect to `/` (map)

## Identity Persistence

- `deviceId` persists across sessions (localStorage)
- If user clears localStorage → creates a new identity on next visit
- If user loses their device → can't recover account (by design — anonymous)

## PIN Usage

- PIN is used to protect the profile view (future: optional)
- PIN is hashed with scrypt + per-user random salt before storage
- The plain PIN is never stored anywhere
- PIN verification: POST `/api/users/{deviceId}/verify-pin`

## Rate Limiting via deviceId

The `deviceId` is used to enforce:
- Click cooldown (tracked in `clicks` table)
- Future: block abusive devices by deviceId in admin

## Badges

Badges are awarded based on total click count:

| Badge | ID | Click count |
|---|---|---|
| Novizio | `novizio` | 0–4 |
| Radar | `radar` | 5–19 |
| Leggenda | `leggenda` | 20+ |

Badges are computed dynamically server-side in `GET /api/users/{deviceId}/stats`.
