# GnoccaTrack — Admin Area

## Access

Route: `/admin`

Protected by a simple PIN gate (hardcoded in the frontend component). The default admin PIN is `admin1234`. Change this before production.

## Admin Tabs

### Statistiche (Stats)
- Total users
- Total clicks ever
- Active hotspots count
- Clicks today
- Top 5 venues by click count

### Config
Slider-based editor for:
- `clickDurationMinutes` — how long a click contributes (default 30)
- `clickCooldownMinutes` — min time between clicks per user (default 30)
- `maxVenuesShown` — max venues in picker (default 6)
- `defaultRadiusMeters` — default Overpass search radius (default 100)
- `appTextMainButton` — text of the main button (default "Qui Gnocca")

Changes saved via PATCH `/api/admin/config`.

### Hotspot
List of all hotspots with:
- Venue name, city, area
- Seed/live badge
- Intensity dropdown (editable)
- Active/inactive badge
- Click count
- Delete button

### Utenti (Users)
List of all users with:
- Nickname
- Click count
- Active/blocked status badge (green = attivo, red = bloccato)
- Block button — ban icon, prevents future clicks (visible for active users)
- Unblock button — shield-check icon, restores access (visible for blocked users)

Toggle is immediate and reflected in the UI via query invalidation.

## API Endpoints Used

```
GET   /api/admin/stats
GET   /api/admin/config
PATCH /api/admin/config
GET   /api/admin/hotspots
POST  /api/admin/hotspots
PATCH /api/admin/hotspots/{id}
DELETE /api/admin/hotspots/{id}
GET   /api/admin/users
POST  /api/admin/users/{id}/block
POST  /api/admin/users/{id}/unblock
```

## Security Note

The admin panel is protected only by a frontend PIN check. For production:
- Move the admin PIN to a server-side environment variable
- Add server-side admin middleware (check a header or session token)
- Consider IP allowlisting for the admin routes
