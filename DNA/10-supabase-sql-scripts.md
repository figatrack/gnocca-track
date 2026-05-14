# GnoccaTrack — Script SQL per Supabase

Questo file contiene **tutti gli script SQL** necessari per configurare GnoccaTrack su Supabase, in ordine di esecuzione. Copia e incolla ogni blocco nel SQL Editor di Supabase.

---

## STEP 1 — Creazione tabelle

```sql
-- ============================================================
-- STEP 1A: Tabella users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              SERIAL PRIMARY KEY,
  device_id       TEXT NOT NULL UNIQUE,
  nickname        TEXT NOT NULL UNIQUE,
  pin_hash        TEXT NOT NULL,
  click_count     INTEGER NOT NULL DEFAULT 0,
  is_blocked      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STEP 1B: Tabella hotspots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hotspots (
  id              SERIAL PRIMARY KEY,
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  intensity       TEXT NOT NULL DEFAULT 'low',
  click_count     INTEGER NOT NULL DEFAULT 0,
  is_seed         BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  venue_osm_id    TEXT,
  venue_name      TEXT NOT NULL,
  venue_type      TEXT,
  city            TEXT NOT NULL DEFAULT '',
  area            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

-- ============================================================
-- STEP 1C: Tabella clicks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clicks (
  id              SERIAL PRIMARY KEY,
  device_id       TEXT NOT NULL,
  hotspot_id      INTEGER NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
  venue_osm_id    TEXT,
  venue_name      TEXT NOT NULL,
  city            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STEP 1D: Tabella admin_config (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_config (
  id                      SERIAL PRIMARY KEY,
  click_duration_minutes   INTEGER NOT NULL DEFAULT 30,
  click_cooldown_minutes   INTEGER NOT NULL DEFAULT 30,
  max_venues_shown         INTEGER NOT NULL DEFAULT 6,
  default_radius_meters    INTEGER NOT NULL DEFAULT 100,
  app_text_main_button     TEXT NOT NULL DEFAULT 'Qui Gnocca',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## STEP 2 — Indici per performance

```sql
-- Hotspot: query per posizione e stato
CREATE INDEX IF NOT EXISTS idx_hotspots_active
  ON public.hotspots (is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_hotspots_coords
  ON public.hotspots (lat, lng);

CREATE INDEX IF NOT EXISTS idx_hotspots_venue_name
  ON public.hotspots (venue_name);

CREATE INDEX IF NOT EXISTS idx_hotspots_venue_osm_id
  ON public.hotspots (venue_osm_id);

-- Clicks: query per device e ordinamento temporale
CREATE INDEX IF NOT EXISTS idx_clicks_device_time
  ON public.clicks (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_hotspot
  ON public.clicks (hotspot_id);

CREATE INDEX IF NOT EXISTS idx_clicks_created_at
  ON public.clicks (created_at DESC);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_device_id
  ON public.users (device_id);

CREATE INDEX IF NOT EXISTS idx_users_nickname
  ON public.users (nickname);

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_key
  ON public.users (lower(nickname));
```

---

## STEP 3 — Trigger updated_at per admin_config

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_config_updated_at ON public.admin_config;
CREATE TRIGGER trg_admin_config_updated_at
  BEFORE UPDATE ON public.admin_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## STEP 4 — Configurazione admin di default

```sql
-- Inserisce config di default (una sola riga, si ignora se esiste già)
INSERT INTO public.admin_config (
  click_duration_minutes,
  click_cooldown_minutes,
  max_venues_shown,
  default_radius_meters,
  app_text_main_button
)
SELECT 30, 30, 6, 100, 'Qui Gnocca'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_config);
```

---

## STEP 5 — Seed hotspot (14 città italiane)

```sql
INSERT INTO public.hotspots (lat, lng, intensity, click_count, is_seed, is_active, venue_name, venue_type, city, area, expires_at)
VALUES
  -- Milano
  (45.4654, 9.1866, 'high',   12, true, true, 'Navigli Bar',          'bar',      'Milano',  'Navigli',       NULL),
  (45.4719, 9.1916, 'medium',  6, true, true, 'Brera Cocktail Club',   'bar',      'Milano',  'Brera',         NULL),
  (45.4597, 9.1820, 'bomb',   22, true, true, 'Darsena Social Club',   'bar',      'Milano',  'Darsena',       NULL),
  (45.4840, 9.1870, 'low',     2, true, true, 'Garibaldi Bistrot',     'bar',      'Milano',  'Garibaldi',     NULL),
  -- Roma
  (41.8955, 12.4722, 'high',  15, true, true, 'Campo de Fiori Bar',    'pub',      'Roma',    'Campo de Fiori',NULL),
  (41.8868, 12.5186, 'medium', 7, true, true, 'Pigneto Social Club',   'bar',      'Roma',    'Pigneto',       NULL),
  (41.8894, 12.4693, 'high',  11, true, true, 'Trastevere Pub',        'pub',      'Roma',    'Trastevere',    NULL),
  -- Torino
  (45.0580, 7.6881, 'medium',  8, true, true, 'Murazzi Lounge',        'bar',      'Torino',  'Murazzi',       NULL),
  (45.0741, 7.6977, 'low',     3, true, true, 'Vanchiglia Taproom',    'bar',      'Torino',  'Vanchiglia',    NULL),
  -- Napoli
  (40.8378, 14.2488, 'high',  14, true, true, 'Chiaia Bar',            'cocktail', 'Napoli',  'Chiaia',        NULL),
  (40.8516, 14.2681, 'medium', 5, true, true, 'Centro Storico Pub',    'pub',      'Napoli',  'Centro Storico',NULL),
  -- Bologna
  (44.4938, 11.3428, 'high',  16, true, true, 'Centro Bologna Lounge', 'bar',      'Bologna', 'Centro',        NULL),
  -- Firenze
  (43.7640, 11.2459, 'medium', 9, true, true, 'Oltrarno Wine Bar',     'bar',      'Firenze', 'Oltrarno',      NULL),
  -- Palermo
  (38.1157, 13.3615, 'bomb',  21, true, true, 'Vucciria Night Club',   'nightclub','Palermo', 'Vucciria',      NULL)
ON CONFLICT DO NOTHING;
```

---

## STEP 6 — Row Level Security (RLS)

```sql
-- Abilita RLS su tutte le tabelle
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clicks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HOTSPOTS: lettura pubblica degli attivi, scrittura solo service_role
-- ============================================================
DROP POLICY IF EXISTS "hotspots_public_read" ON public.hotspots;
CREATE POLICY "hotspots_public_read" ON public.hotspots
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "hotspots_service_all" ON public.hotspots;
CREATE POLICY "hotspots_service_all" ON public.hotspots
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- CLICKS: inserimento e lettura solo service_role
-- ============================================================
DROP POLICY IF EXISTS "clicks_service_all" ON public.clicks;
CREATE POLICY "clicks_service_all" ON public.clicks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- USERS: lettura/scrittura solo service_role
-- ============================================================
DROP POLICY IF EXISTS "users_service_all" ON public.users;
CREATE POLICY "users_service_all" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ADMIN_CONFIG: lettura/scrittura solo service_role
-- ============================================================
DROP POLICY IF EXISTS "admin_config_service_all" ON public.admin_config;
CREATE POLICY "admin_config_service_all" ON public.admin_config
  FOR ALL USING (auth.role() = 'service_role');
```

---

## STEP 7 — Verifica struttura tabelle

```sql
-- Verifica che tutte le tabelle esistano con le colonne corrette
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'hotspots', 'clicks', 'admin_config')
ORDER BY table_name, ordinal_position;
```

**Risultato atteso:** Le 4 tabelle con tutte le colonne elencate nei STEP 1A-1D.

---

## STEP 8 — Verifica indici

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'hotspots', 'clicks', 'admin_config')
ORDER BY tablename, indexname;
```

**Risultato atteso:** Almeno 7 indici (vedi STEP 2).

---

## STEP 9 — Verifica seed data

```sql
-- Conta hotspot seed
SELECT
  city,
  COUNT(*) AS hotspots,
  SUM(click_count) AS total_clicks,
  MAX(intensity) AS max_intensity
FROM public.hotspots
WHERE is_seed = true
GROUP BY city
ORDER BY total_clicks DESC;

-- Verifica config di default
SELECT * FROM public.admin_config;
```

**Risultato atteso:**
- 7 città con almeno 14 hotspot totali
- 1 riga in admin_config con valori di default

---

## STEP 10 — Verifica RLS policies

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Risultato atteso:** Almeno 5 policy, una per tabella.

---

## STEP 11 — Query diagnostica live (dopo utenti reali)

```sql
-- Dashboard riassuntiva
SELECT
  (SELECT COUNT(*) FROM public.users) AS total_users,
  (SELECT COUNT(*) FROM public.users WHERE is_blocked = true) AS blocked_users,
  (SELECT COUNT(*) FROM public.hotspots WHERE is_active = true) AS active_hotspots,
  (SELECT COUNT(*) FROM public.hotspots WHERE is_seed = true) AS seed_hotspots,
  (SELECT COUNT(*) FROM public.clicks) AS total_clicks,
  (SELECT COUNT(*) FROM public.clicks WHERE created_at >= NOW() - INTERVAL '24 hours') AS clicks_today,
  (SELECT COUNT(*) FROM public.clicks WHERE created_at >= NOW() - INTERVAL '1 hour') AS clicks_last_hour;

-- Top 10 utenti per click
SELECT
  u.nickname,
  u.click_count,
  u.is_blocked,
  u.created_at
FROM public.users u
ORDER BY u.click_count DESC
LIMIT 10;

-- Top 10 venue per click
SELECT
  h.venue_name,
  h.city,
  h.area,
  h.click_count,
  h.intensity,
  h.is_seed,
  h.expires_at
FROM public.hotspots h
WHERE h.is_active = true
ORDER BY h.click_count DESC
LIMIT 10;

-- Distribuzione intensità hotspot attivi
SELECT
  intensity,
  COUNT(*) AS count
FROM public.hotspots
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
GROUP BY intensity
ORDER BY count DESC;
```

---

## STEP 12 — Script di reset (USE WITH CAUTION)

```sql
-- ⚠️ ATTENZIONE: Elimina tutti i dati utente reali (NON tocca i seed)
BEGIN;

DELETE FROM public.clicks;
DELETE FROM public.users;
DELETE FROM public.hotspots WHERE is_seed = false;
UPDATE public.hotspots
  SET click_count = 0, intensity = 'low'
  WHERE is_seed = true;

COMMIT;

-- ✅ Verifica post-reset
SELECT
  (SELECT COUNT(*) FROM public.users) AS users,
  (SELECT COUNT(*) FROM public.clicks) AS clicks,
  (SELECT COUNT(*) FROM public.hotspots WHERE is_seed = false) AS live_hotspots,
  (SELECT COUNT(*) FROM public.hotspots WHERE is_seed = true) AS seed_hotspots;
```

---

## STEP 13 — Teardown completo (solo per re-setup totale)

```sql
-- ⚠️ DISTRUGGE TUTTO — usa solo per ripartire da zero
DROP TABLE IF EXISTS public.clicks CASCADE;
DROP TABLE IF EXISTS public.hotspots CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.admin_config CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;
```

---

## Note operative

| Variabile | Valore | Dove impostare |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres` | Local/prod environment |
| `ADMIN_PIN` | Strong private admin PIN | Backend environment |
| Service role key | Supabase → Settings → API → service_role | Solo backend, mai frontend |
| Anon key | Supabase → Settings → API → anon | Non necessaria con Express |

**La connessione al DB deve usare la service role** (bypass RLS), non la anon key.
La stringa di connessione si trova in: Supabase Dashboard → Settings → Database → Connection String → URI.

Usa la **Connection Pooler (Transaction mode)** per produzione su Render (porta 6543), la diretta (porta 5432) per development.
