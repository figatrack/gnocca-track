# GnoccaTrack — "Qui Gnocca" Logic

## Button Flow

```
User taps "Qui Gnocca"
    ↓
Check cooldown (GET /api/clicks/cooldown/{deviceId})
    ↓ if cooldown active
    Show cooldown sheet (time remaining)
    ↓ if OK
Check GPS position
    ↓ if no GPS
    Show error toast
    ↓ if GPS available
Fetch nearby venues (Overpass, cached 10min)
    ↓ if nearest < 80m
    Show confirmation: "Sei da [Venue Name]?"
    ↓ if no venue within 80m
    Show venue picker (max 6 venues)
        ↓ user selects
        Show confirmation
            ↓ user confirms
POST /api/clicks { deviceId, lat, lng, venueName, venueOsmId, city }
    ↓ server upserts hotspot, increments count, records click
    ↓ updates user.clickCount
    ↓ returns 201 or 429
Show success animation
Invalidate hotspots + cooldown queries
```

## Click Registration (Server)

1. Validate `RegisterClickBody` with Zod
2. Check cooldown: query last click for device, compare timestamps
3. If cooldown active → return 429 with `secondsRemaining` and `nextClickAt`
4. Compute `expiresAt` = now + `clickDurationMinutes`
5. If venue already has a hotspot → increment `clickCount`, update `expiresAt`
6. If no existing hotspot → create new hotspot at lat/lng
7. Insert click record
8. Increment `user.clickCount`

## Admin-Configurable Parameters

| Parameter | Default | Description |
|---|---|---|
| `clickDurationMinutes` | 30 | How long a click contributes to hotspot intensity |
| `clickCooldownMinutes` | 30 | Min time between clicks per device |
| `maxVenuesShown` | 6 | Max venues shown in picker |
| `defaultRadiusMeters` | 100 | Default search radius |

## Hotspot Expiry

Hotspots are auto-deactivated when `expiresAt < NOW()`. The server filters by:
```sql
WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
```

Seed hotspots have `expires_at = NULL` so they are always visible.
