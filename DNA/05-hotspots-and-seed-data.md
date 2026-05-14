# GnoccaTrack — Hotspots & Seed Data

## Hotspot Data Model

| Field | Type | Description |
|---|---|---|
| `id` | serial PK | Auto-generated |
| `lat` | real | Latitude |
| `lng` | real | Longitude |
| `intensity` | text | Computed: low/medium/high/bomb |
| `clickCount` | integer | Total accumulated clicks |
| `isSeed` | boolean | True = seed/demo hotspot |
| `isActive` | boolean | False = deactivated |
| `venueName` | text | Display name |
| `venueType` | text | bar/pub/cocktail_bar/restaurant |
| `city` | text | Italian city |
| `area` | text | Neighborhood/district |
| `expiresAt` | timestamp | NULL for seeds = never expires |

## Intensity Computation

Intensity is computed dynamically at query time from `clickCount`:
```typescript
if (clickCount >= 20) return "bomb";
if (clickCount >= 10) return "high";
if (clickCount >= 4) return "medium";
return "low";
```

## Seed Hotspots

Seed hotspots make the app feel alive during the initial launch phase before real users generate data.

**Current seeds:** 14 hotspots across 7 Italian cities:
- Milano (4): Navigli, Brera, Darsena, Garibaldi
- Roma (3): Campo de' Fiori, Pigneto, Trastevere
- Torino (2): Murazzi, Vanchiglia
- Napoli (2): Chiaia, Centro Storico
- Bologna (1): Centro
- Firenze (1): Oltrarno
- Palermo (1): Vucciria

**Current operational test hotspots:** 50 Bologna test hotspots:
- Names: `Bologna Test Focolaio 01` through `Bologna Test Focolaio 50`
- `venue_osm_id`: `test/bologna/01` through `test/bologna/50`
- `city = 'Bologna'`
- `is_seed = true`, `is_active = true`, `expires_at = NULL`
- Purpose: visible QA/demo density in Bologna while validating marker animation and map behavior
- Remove or deactivate these before a real production launch if test density is no longer desired

**Properties of seed hotspots:**
- `is_seed = true`
- `is_active = true`
- `expires_at = NULL` (never expire unless explicitly deactivated)
- Mixed intensity levels to simulate realistic activity

## Admin Management

Admin can via the admin panel:
- View all hotspots (including seeds)
- Change intensity level manually
- Toggle active/inactive
- Delete any hotspot
- Create new seed hotspots for new cities

## Adding More Cities

Via Admin → Hotspot → Create:
```json
{
  "lat": 45.4654,
  "lng": 9.1866,
  "venueName": "Il tuo locale",
  "city": "Milano",
  "area": "Navigli",
  "isSeed": true,
  "isActive": true
}
```
