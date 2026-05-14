# GnoccaTrack — Map & Geolocation Logic

## Map Library

**MapLibre GL JS** — open-source, no API key required, smooth on mobile.

## Map Tile Providers

| Mode | URL |
|---|---|
| Dark | `https://tiles.openfreemap.org/styles/dark` |
| Light | `https://tiles.openfreemap.org/styles/liberty` |

Both are free, open, no API key needed. If the vector style does not load, the app falls back to CARTO raster tiles so mobile users still see a usable map.

## GPS Flow

1. App loads → `navigator.geolocation.watchPosition()` starts in high-accuracy mode
2. On success → map flies to user position (zoom 15)
3. User position shown as pulsing pink dot on map
4. Position is used for local hotspot queries and Overpass venue detection
5. If high-accuracy GPS fails, the app retries with lower accuracy

## Venue Detection (Overpass API)

Venue detection is **live, not from a database**. When user taps "Qui Gnocca":

1. Current GPS lat/lng sent to Overpass API
2. Query fetches OSM nodes/ways/relations for food and nightlife venues within a configurable radius, with a client-side minimum of 500m
3. Results sorted by distance from user
4. Up to 300 local venue candidates are fetched so dense city centers are searchable
5. If nearest venue is < 80m → auto-proposes it for confirmation
6. If no venue within 80m → shows a searchable venue picker
7. Curated fallback venues can be added for verified real venues missing from OSM; currently includes `Camera con Vista Bistrot` in Bologna

### Overpass Query Template

```
[out:json][timeout:10];
(
  node["amenity"~"^(bar|pub|restaurant|cafe|nightclub|fast_food|food_court|ice_cream|biergarten|events_venue)$"](around:{radius},{lat},{lng});
  way["amenity"~"^(bar|pub|restaurant|cafe|nightclub|fast_food|food_court|ice_cream|biergarten|events_venue)$"](around:{radius},{lat},{lng});
  relation["amenity"~"^(bar|pub|restaurant|cafe|nightclub|fast_food|food_court|ice_cream|biergarten|events_venue)$"](around:{radius},{lat},{lng});
  node["leisure"~"^(dance)$"](around:{radius},{lat},{lng});
  way["leisure"~"^(dance)$"](around:{radius},{lat},{lng});
  relation["leisure"~"^(dance)$"](around:{radius},{lat},{lng});
);
out center;
```

## Venue Cache

To avoid hammering Overpass API, results are cached in memory per grid cell (0.01° precision ≈ 1km grid), radius, and result limit for **10 minutes**.

```typescript
const key = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100},${radiusMeters},${maxVenues}`;
```

## Hotspot Loading

The public map does not show all global hotspots. It queries `/api/hotspots` with GPS coordinates and a 50km radius, so markers are local to the user. If GPS is unavailable, the local hotspot query stays disabled rather than showing misleading global seed hotspots.

## Hotspot Markers

Each hotspot is rendered as a CSS-animated circle via MapLibre custom markers. The MapLibre positioning transform stays on an outer `.hotspot-marker` element; the pulse animation runs on an inner marker element so animation does not override marker positioning.

| Intensity | Color | Size | Animation |
|---|---|---|---|
| `low` | Muted pink `#f472b6` | 12px | Slow pulse 2s |
| `medium` | Hot pink `#FF0880` | 20px | Pulse with glow 1.5s |
| `high` | Hot pink + white border | 28px | Fast pulse 1s |
| `bomb` | Hot pink + gold border | 36px | Rapid pulse 0.8s |

## Intensity Thresholds (server-side)

| Clicks | Intensity |
|---|---|
| 0–3 | low |
| 4–9 | medium |
| 10–19 | high |
| 20+ | bomb |
