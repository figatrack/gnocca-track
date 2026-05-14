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
    Show searchable venue picker
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
2. Require a registered, non-blocked user for the provided `deviceId`
3. Check cooldown: query last click for device, compare timestamps
4. If cooldown active → return 429 with `secondsRemaining` and `nextClickAt`
5. Compute `expiresAt` = now + `clickDurationMinutes`
6. If venue already has a hotspot → increment `clickCount`, update intensity and expiry
7. For non-seed existing hotspots, update coordinates to the selected venue coordinates
8. If no existing hotspot → create new hotspot at the selected venue coordinates
9. Insert click record
10. Increment `user.clickCount`

## Admin-Configurable Parameters

| Parameter | Default | Description |
|---|---|---|
| `clickDurationMinutes` | 30 | How long a click contributes to hotspot intensity |
| `clickCooldownMinutes` | 30 | Min time between clicks per device |
| `maxVenuesShown` | 6 | Max venues shown in picker |
| `defaultRadiusMeters` | 100 | Default search radius |

The frontend enforces a 500m minimum venue search radius and fetches up to 300 candidates so the picker remains useful in dense city centers. The admin value still controls the configured default radius and remains the source of truth for server config.

## Venue Fallback Rules

The app does not fall back to the nearest global hotspot when no venue is found. That caused misleading confirmations for users far from seed hotspots. If Overpass returns no venue, the user sees a toast and no click is registered.

Verified venues missing or misclassified in OpenStreetMap can be added as curated frontend fallbacks. Current curated fallback:

| Venue | City | Coordinates | Reason |
|---|---|---|---|
| Camera con Vista Bistrot | Bologna | `44.4927488, 11.3477163` | Real venue exists on web, but OSM/Overpass does not expose it as a matching POI |

## Hotspot Expiry

Hotspots are auto-deactivated when `expiresAt < NOW()`. The server filters by:
```sql
WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
```

Seed hotspots have `expires_at = NULL` so they are always visible.
