# GnoccaTrack — Map & Geolocation Logic

## Map Library

**MapLibre GL JS** — open-source, no API key required, smooth on mobile.

## Map Tile Providers

| Mode | URL |
|---|---|
| Dark | `https://tiles.openfreemap.org/styles/dark` |
| Light | `https://tiles.openfreemap.org/styles/liberty` |

Both are free, open, no API key needed. Fallback: `https://demotiles.maplibre.org/style.json`

## GPS Flow

1. App loads → `navigator.geolocation.getCurrentPosition()` called
2. On success → map flies to user position (zoom 15)
3. User position shown as pulsing pink dot on map
4. Position used for all Overpass queries and click registration

## Venue Detection (Overpass API)

Venue detection is **live, not from a database**. When user taps "Qui Gnocca":

1. Current GPS lat/lng sent to Overpass API
2. Query fetches OSM nodes with `amenity` in `bar|pub|restaurant|cafe|nightclub` within a configurable radius (default 150m)
3. Results sorted by distance from user
4. Max 6 results shown
5. If nearest venue is < 80m → auto-proposes it for confirmation
6. If no venue within 80m → shows list of all nearby venues to pick from

### Overpass Query Template

```
[out:json][timeout:10];
(
  node["amenity"~"bar|pub|restaurant|cafe"](around:{radius},{lat},{lng});
  node["amenity"="nightclub"](around:{radius},{lat},{lng});
);
out body;
```

## Venue Cache

To avoid hammering Overpass API, results are cached in memory per grid cell (0.01° precision ≈ 1km grid) for **10 minutes**.

```typescript
const gridKey = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
```

## Hotspot Markers

Each hotspot is rendered as a CSS-animated circle via MapLibre custom markers:

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
