import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import maplibregl from "maplibre-gl";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListHotspots,
  useRegisterClick,
  useGetCooldownStatus,
  useGetHotspotStats,
  getListHotspotsQueryKey,
  getGetCooldownStatusQueryKey,
  getGetHotspotStatsQueryKey,
} from "@workspace/api-client-react";
import type { Hotspot } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStoredUser, getTheme, setTheme } from "@/lib/storage";
import { User, Sun, Moon, Crosshair, MapPin, CheckCircle, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import appIcon from "@/assets/app-icon.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type GpsState = "waiting" | "ok" | "denied" | "unavailable";
type Sheet = "confirm" | "venues" | "cooldown" | null;

interface NearbyVenue {
  name: string;
  lat: number;
  lng: number;
  distance: number;
  osmId?: string;
  type?: string;
}

interface PublicConfig {
  maxVenuesShown: number;
  defaultRadiusMeters: number;
  appTextMainButton: string;
}

interface HotspotMarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLDivElement;
  title: HTMLDivElement;
  count: HTMLDivElement;
  lat: number;
  lng: number;
  intensity: Hotspot["intensity"];
  venueName: string;
  clickCount: number;
}

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  maxVenuesShown: 6,
  defaultRadiusMeters: 150,
  appTextMainButton: "Qui Gnocca",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchPublicConfig(): Promise<PublicConfig> {
  const resp = await fetch("/api/config");
  if (!resp.ok) throw new Error("Unable to load app config");
  return { ...DEFAULT_PUBLIC_CONFIG, ...(await resp.json()) };
}

async function fetchNearbyVenues(
  lat: number,
  lng: number,
  radiusMeters: number,
  maxVenues: number,
): Promise<NearbyVenue[]> {
  const query = `[out:json][timeout:10];(node["amenity"~"bar|pub|restaurant|cafe"](around:${radiusMeters},${lat},${lng});node["amenity"="nightclub"](around:${radiusMeters},${lat},${lng}););out body;`;
  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.elements ?? [])
      .filter((el: { tags?: { name?: string } }) => el.tags?.name)
      .map((el: { id: number; lat: number; lon: number; tags: { name: string; amenity?: string } }) => ({
        name: el.tags.name,
        lat: el.lat,
        lng: el.lon,
        distance: haversineDistance(lat, lng, el.lat, el.lon),
        osmId: String(el.id),
        type: el.tags.amenity,
      }))
      .sort((a: NearbyVenue, b: NearbyVenue) => a.distance - b.distance)
      .slice(0, maxVenues);
  } catch {
    return [];
  }
}

const venueCache = new Map<string, { venues: NearbyVenue[]; time: number }>();

async function fetchVenuesCached(
  lat: number,
  lng: number,
  radiusMeters: number,
  maxVenues: number,
): Promise<NearbyVenue[]> {
  const key = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100},${radiusMeters},${maxVenues}`;
  const hit = venueCache.get(key);
  if (hit && Date.now() - hit.time < 10 * 60 * 1000) return hit.venues;
  const venues = await fetchNearbyVenues(lat, lng, radiusMeters, maxVenues);
  venueCache.set(key, { venues, time: Date.now() });
  return venues;
}

function createHotspotMarker(hotspot: Hotspot): HotspotMarkerEntry {
  const el = document.createElement("div");
  el.className = `marker-${hotspot.intensity}`;
  el.style.cursor = "pointer";
  el.style.willChange = "transform";

  const popupRoot = document.createElement("div");
  popupRoot.style.cssText = "font-family:Outfit,sans-serif;padding:4px 2px;min-width:120px;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:700;font-size:14px;";
  title.textContent = hotspot.venueName;

  const count = document.createElement("div");
  count.style.cssText = "color:#FF0880;font-size:12px;margin-top:2px;";
  count.textContent = `${hotspot.clickCount} segnalazioni`;

  popupRoot.append(title, count);

  const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setDOMContent(popupRoot);
  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([hotspot.lng, hotspot.lat])
    .setPopup(popup);

  return {
    marker,
    el,
    title,
    count,
    lat: hotspot.lat,
    lng: hotspot.lng,
    intensity: hotspot.intensity,
    venueName: hotspot.venueName,
    clickCount: hotspot.clickCount,
  };
}

function updateHotspotMarker(entry: HotspotMarkerEntry, hotspot: Hotspot) {
  if (entry.lat !== hotspot.lat || entry.lng !== hotspot.lng) {
    entry.marker.setLngLat([hotspot.lng, hotspot.lat]);
    entry.lat = hotspot.lat;
    entry.lng = hotspot.lng;
  }

  if (entry.intensity !== hotspot.intensity) {
    entry.el.className = `marker-${hotspot.intensity}`;
    entry.intensity = hotspot.intensity;
  }

  if (entry.venueName !== hotspot.venueName) {
    entry.title.textContent = hotspot.venueName;
    entry.venueName = hotspot.venueName;
  }

  if (entry.clickCount !== hotspot.clickCount) {
    entry.count.textContent = `${hotspot.clickCount} segnalazioni`;
    entry.clickCount = hotspot.clickCount;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [, navigate] = useLocation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, HotspotMarkerEntry>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const activeWatchRef = useRef<number | null>(null);

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<GpsState>("waiting");
  const [theme, setThemeState] = useState<"dark" | "light">(getTheme());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [nearbyVenues, setNearbyVenues] = useState<NearbyVenue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<NearbyVenue | null>(null);
  const [clickSuccess, setClickSuccess] = useState(false);
  const [buttonBounce, setButtonBounce] = useState(false);

  const stored = getStoredUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tileStyle = theme === "dark"
    ? "https://tiles.openfreemap.org/styles/dark"
    : "https://tiles.openfreemap.org/styles/liberty";

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: hotspots = [] } = useListHotspots(undefined, {
    query: { queryKey: getListHotspotsQueryKey(), refetchInterval: 30000 },
  });

  const { data: cooldown } = useGetCooldownStatus(stored?.deviceId ?? "", {
    query: {
      queryKey: getGetCooldownStatusQueryKey(stored?.deviceId ?? ""),
      enabled: !!stored?.deviceId,
      refetchInterval: 10000,
    },
  });

  const { data: stats } = useGetHotspotStats({
    query: { queryKey: getGetHotspotStatsQueryKey() },
  });

  const registerClick = useRegisterClick();
  const { data: loadedConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: fetchPublicConfig,
    retry: 1,
    staleTime: 60000,
  });
  const publicConfig = loadedConfig ?? DEFAULT_PUBLIC_CONFIG;

  // ─── GPS helpers (stable refs to avoid stale closure in useEffect) ────────

  const userMarkerElRef = useRef<HTMLDivElement | null>(null);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const onGpsSuccess = useCallback((pos: GeolocationPosition) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    userPosRef.current = { lat, lng };
    setUserPos({ lat, lng });
    setGpsState("ok");

    if (!userMarkerRef.current && map.current) {
      map.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 });
      const el = document.createElement("div");
      el.style.cssText = [
        "width:20px", "height:20px", "border-radius:50%",
        "background:#FF0880", "border:3px solid white",
        "box-shadow:0 0 12px rgba(255,8,128,0.6)",
        "will-change:transform",
      ].join(";");
      userMarkerElRef.current = el;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      userMarkerRef.current?.setLngLat([lng, lat]);
    }
  }, []);

  const startWatch = useCallback((highAccuracy: boolean, isRetry = false) => {
    if (activeWatchRef.current !== null) {
      navigator.geolocation.clearWatch(activeWatchRef.current);
      activeWatchRef.current = null;
    }

    const id = navigator.geolocation.watchPosition(
      onGpsSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // User denied — permanent
          setGpsState("denied");
        } else if (!isRetry) {
          // TIMEOUT or POSITION_UNAVAILABLE on high-accuracy — fall back to low accuracy
          setGpsState("unavailable");
          startWatch(false, true);
        } else {
          setGpsState("unavailable");
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 30000,
        maximumAge: highAccuracy ? 15000 : 30000,
      }
    );
    activeWatchRef.current = id;
  }, [onGpsSuccess]);

  const clearAllWatches = useCallback(() => {
    if (activeWatchRef.current !== null) {
      navigator.geolocation.clearWatch(activeWatchRef.current);
      activeWatchRef.current = null;
    }
  }, []);

  // ─── Map + GPS init ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!stored) { navigate("/onboarding"); return; }
    if (!mapContainer.current || map.current) return;

    // MapLibre — mobile-safe options
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: tileStyle,
      center: [12.4922, 41.8902],
      zoom: 13,
      attributionControl: false,
      // Critical for older Android WebViews — don't fail on performance caveats
      failIfMajorPerformanceCaveat: false,
      // Disable gestures that make no sense in this app and cause accidental triggers
      dragRotate: false,
      touchPitch: false,
      maxZoom: 19,
      minZoom: 5,
    });

    map.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left"
    );

    // Resize map on orientation change and virtual keyboard events
    const handleResize = () => {
      // small delay so browser finishes its own layout pass first
      setTimeout(() => map.current?.resize(), 100);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    // Re-acquire GPS when PWA comes back to foreground (iOS kills background watches)
    const handleVisibility = () => {
      if (!document.hidden) {
        // Restart only if not already ok (avoid double-watch)
        const currentState = userPosRef.current ? "ok" : "waiting";
        if (currentState !== "ok") {
          clearAllWatches();
          startWatch(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Start GPS — always begin with high accuracy
    startWatch(true);

    return () => {
      clearAllWatches();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      markersRef.current.forEach((entry) => entry.marker.remove());
      markersRef.current.clear();
      map.current?.remove();
      map.current = null;
      userMarkerRef.current = null;
      userMarkerElRef.current = null;
      userPosRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Hotspot markers ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!map.current) return;
    const activeIds = new Set<number>();

    for (const h of hotspots) {
      if (!h.isActive) continue;
      activeIds.add(h.id);

      const existing = markersRef.current.get(h.id);
      if (existing) {
        updateHotspotMarker(existing, h);
        continue;
      }

      const entry = createHotspotMarker(h);
      entry.marker.addTo(map.current);
      markersRef.current.set(h.id, entry);
    }

    for (const [id, entry] of markersRef.current) {
      if (!activeIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [hotspots]);

  // ─── Theme change ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map.current) return;
    if (map.current.isStyleLoaded()) {
      try { map.current.setStyle(tileStyle); } catch {}
    } else {
      map.current.once("load", () => {
        try { map.current?.setStyle(tileStyle); } catch {}
      });
    }
  }, [tileStyle]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const centerOnUser = useCallback(() => {
    const pos = userPosRef.current;
    if (!pos || !map.current) return;
    map.current.flyTo({ center: [pos.lng, pos.lat], zoom: 15, duration: 800 });
  }, []);

  const handleQuiGnocca = async () => {
    if (!stored) { navigate("/onboarding"); return; }
    if (cooldown && !cooldown.canClick) { setSheet("cooldown"); return; }

    setButtonBounce(true);
    setTimeout(() => setButtonBounce(false), 400);

    const pos = userPos ?? userPosRef.current;
    if (!pos) {
      if (gpsState === "denied") {
        toast({
          title: "GPS non autorizzato",
          description: "Vai in Impostazioni > Privacy > Localizzazione e attiva per questo browser",
        });
      } else if (gpsState === "unavailable") {
        toast({
          title: "Segnale GPS assente",
          description: "Avvicinati a una finestra o vai all'aperto",
        });
      } else {
        toast({ title: "GPS in acquisizione", description: "Aspetta qualche secondo" });
      }
      return;
    }

    const venues = await fetchVenuesCached(
      pos.lat,
      pos.lng,
      publicConfig.defaultRadiusMeters,
      publicConfig.maxVenuesShown,
    );
    setNearbyVenues(venues);

    if (venues.length === 0) {
      const nearest = [...hotspots].sort(
        (a, b) =>
          haversineDistance(pos.lat, pos.lng, a.lat, a.lng) -
          haversineDistance(pos.lat, pos.lng, b.lat, b.lng)
      )[0];
      if (nearest) {
        setSelectedVenue({ name: nearest.venueName, lat: nearest.lat, lng: nearest.lng, distance: 0 });
        setSheet("confirm");
      } else {
        toast({ title: "Nessun locale trovato", description: "Avvicinati a un bar o pub" });
      }
      return;
    }

    const nearest = venues[0];
    if (nearest.distance < 80) {
      setSelectedVenue(nearest);
      setSheet("confirm");
    } else {
      setSheet("venues");
    }
  };

  const handleConfirm = async () => {
    const pos = userPos ?? userPosRef.current;
    if (!selectedVenue || !stored || !pos) return;
    try {
      await registerClick.mutateAsync({
        data: {
          deviceId: stored.deviceId,
          lat: pos.lat,
          lng: pos.lng,
          venueName: selectedVenue.name,
          venueOsmId: selectedVenue.osmId,
          city: null,
        },
      });
      setSheet(null);
      setClickSuccess(true);
      setTimeout(() => setClickSuccess(false), 2500);
      queryClient.invalidateQueries({ queryKey: getListHotspotsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCooldownStatusQueryKey(stored.deviceId) });
    } catch (err: unknown) {
      const anyErr = err as { status?: number };
      if (anyErr?.status === 429) {
        setSheet("cooldown");
      } else {
        toast({ title: "Errore nella segnalazione" });
      }
    }
  };

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ─── GPS status bar (shown when not "ok") ────────────────────────────────

  const gpsBar = gpsState !== "ok" ? (
    <div
      className="mx-4 rounded-2xl px-4 py-2.5 text-center"
      style={{
        background: gpsState === "denied"
          ? "rgba(234,179,8,0.18)"
          : "rgba(255,8,128,0.12)",
        border: `1px solid ${gpsState === "denied" ? "rgba(234,179,8,0.4)" : "rgba(255,8,128,0.25)"}`,
      }}
    >
      {gpsState === "waiting" && (
        <div className="flex items-center justify-center gap-2">
          <Navigation size={13} className="animate-pulse" style={{ color: "#FF0880" }} />
          <p className="text-xs font-semibold" style={{ color: "#FF0880" }}>
            Acquisizione GPS...
          </p>
        </div>
      )}
      {gpsState === "unavailable" && (
        <div className="flex items-center justify-center gap-2">
          <Navigation size={13} style={{ color: "#FF0880" }} />
          <p className="text-xs font-semibold" style={{ color: "#FF0880" }}>
            Segnale GPS debole — vai all'aperto
          </p>
        </div>
      )}
      {gpsState === "denied" && (
        <p className="text-xs font-semibold text-yellow-300">
          GPS non autorizzato — attivalo in Impostazioni
        </p>
      )}
    </div>
  ) : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="w-screen relative overflow-hidden bg-background"
      style={{ height: "100dvh" }}
    >
      {/* Map canvas */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Top overlay: header + live pill + GPS bar stacked */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex flex-col gap-2 pb-2"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-4">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center shadow-lg"
            style={{ touchAction: "manipulation" }}
          >
            {theme === "dark"
              ? <Sun size={18} className="text-foreground" />
              : <Moon size={18} className="text-foreground" />}
          </button>

          <img src={appIcon} alt="GnoccaTrack" className="h-10 w-10 object-cover rounded-2xl shadow-lg" />

          <button
            onClick={() => navigate("/profile")}
            className="w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center shadow-lg"
            style={{ touchAction: "manipulation" }}
          >
            <User size={18} className="text-foreground" />
          </button>
        </div>

        {/* Live hotspot count pill */}
        {stats && (
          <div className="flex justify-center">
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-foreground">
                {stats.totalActive} hotspot attivi
              </span>
            </div>
          </div>
        )}

        {/* GPS status bar (hidden when ok) */}
        {gpsBar}
      </div>

      {/* Bottom overlay: cooldown timer + action buttons */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-4 px-6"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 32px)" }}
      >
        {cooldown && !cooldown.canClick && (
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-2xl px-5 py-2.5 shadow-lg">
            <span className="text-xs text-muted-foreground font-medium">
              Prossima segnalazione in {formatCooldown(cooldown.secondsRemaining)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={centerOnUser}
            className="w-12 h-12 rounded-full bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center shadow-lg"
            style={{ touchAction: "manipulation" }}
          >
            <Crosshair
              size={20}
              className={gpsState === "ok" ? "text-foreground" : "text-muted-foreground"}
            />
          </button>

          <motion.button
            onClick={handleQuiGnocca}
            animate={buttonBounce ? { scale: [1, 1.12, 0.95, 1] } : {}}
            transition={{ duration: 0.4 }}
            whileTap={{ scale: 0.93 }}
            disabled={registerClick.isPending}
            className="relative h-16 px-10 rounded-full text-white text-xl font-black tracking-wide shadow-2xl disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, #FF0880 0%, #c4006e 100%)",
              boxShadow: "0 0 30px rgba(255,8,128,0.5), 0 4px 20px rgba(0,0,0,0.3)",
              touchAction: "manipulation",
            }}
          >
            {publicConfig.appTextMainButton}
            <div
              className="absolute inset-0 rounded-full opacity-30"
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)" }}
            />
          </motion.button>

          <div className="w-12 h-12" />
        </div>
      </div>

      {/* ── Success toast ── */}
      <AnimatePresence>
        {clickSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div
              className="rounded-3xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl"
              style={{
                background: "rgba(13,11,30,0.92)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,8,128,0.3)",
              }}
            >
              <CheckCircle size={48} style={{ color: "#FF0880" }} />
              <p className="text-xl font-black text-white">Gnocca segnalata!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheet backdrop ── */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 z-30"
            onClick={() => setSheet(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Sheets ── */}
      <AnimatePresence>
        {sheet === "confirm" && selectedVenue && (
          <SheetConfirm
            venue={selectedVenue}
            loading={registerClick.isPending}
            onConfirm={handleConfirm}
            onPickOther={() => setSheet("venues")}
            onClose={() => setSheet(null)}
          />
        )}

        {sheet === "venues" && (
          <SheetVenues
            venues={nearbyVenues}
            onSelect={(v) => { setSelectedVenue(v); setSheet("confirm"); }}
            onClose={() => setSheet(null)}
          />
        )}

        {sheet === "cooldown" && cooldown && (
          <SheetCooldown
            seconds={cooldown.secondsRemaining}
            onClose={() => setSheet(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sheet sub-components ──────────────────────────────────────────────────────

const sheetStyle: React.CSSProperties = {
  background: "hsl(var(--card))",
  borderTop: "1px solid hsl(var(--border))",
};

function SheetHandle() {
  return <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-6" />;
}

function SheetConfirm({
  venue, loading, onConfirm, onPickOther, onClose,
}: {
  venue: NearbyVenue;
  loading: boolean;
  onConfirm: () => void;
  onPickOther: () => void;
  onClose: () => void;
}) {
  void onClose;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl px-6 pt-2"
      style={{ ...sheetStyle, paddingBottom: "max(env(safe-area-inset-bottom), 40px)" }}
    >
      <SheetHandle />
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground font-medium">Sei da</p>
          <h2 className="text-2xl font-black text-foreground mt-1">{venue.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {venue.distance > 0 ? `${Math.round(venue.distance)}m di distanza` : "In zona"}
          </p>
        </div>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-lg font-black text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #FF0880 0%, #c4006e 100%)", touchAction: "manipulation" }}
        >
          {loading ? "Segnalando..." : "Conferma"}
        </button>
        <button
          onClick={onPickOther}
          className="text-center text-sm text-muted-foreground py-1"
          style={{ touchAction: "manipulation" }}
        >
          Non e questo locale
        </button>
      </div>
    </motion.div>
  );
}

function SheetVenues({
  venues, onSelect, onClose,
}: {
  venues: NearbyVenue[];
  onSelect: (v: NearbyVenue) => void;
  onClose: () => void;
}) {
  void onClose;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl px-6 pt-2 flex flex-col"
      style={{
        ...sheetStyle,
        paddingBottom: "max(env(safe-area-inset-bottom), 40px)",
        maxHeight: "70dvh",
      }}
    >
      <div className="flex-none">
        <SheetHandle />
        <h2 className="text-lg font-black text-foreground mb-4">Scegli il locale</h2>
      </div>
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-3"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {venues.map((v) => (
          <button
            key={v.osmId ?? v.name}
            onClick={() => onSelect(v)}
            className="w-full flex items-center gap-4 bg-background rounded-2xl px-4 py-4 text-left border border-border"
            style={{ touchAction: "manipulation" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-none"
              style={{ backgroundColor: "rgba(255,8,128,0.15)" }}
            >
              <MapPin size={16} style={{ color: "#FF0880" }} />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">{v.name}</div>
              <div className="text-xs text-muted-foreground">{Math.round(v.distance)}m</div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function SheetCooldown({ seconds, onClose }: { seconds: number; onClose: () => void }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const label = m > 0 ? `${m}m ${s}s` : `${s}s`;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl px-6 pt-2"
      style={{ ...sheetStyle, paddingBottom: "max(env(safe-area-inset-bottom), 40px)" }}
    >
      <SheetHandle />
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(255,8,128,0.1)" }}
        >
          <MapPin size={28} style={{ color: "#FF0880" }} />
        </div>
        <h2 className="text-xl font-black text-foreground">Aspetta ancora un po'</h2>
        <p className="text-muted-foreground text-sm">
          Puoi segnalare di nuovo tra{" "}
          <span className="font-bold" style={{ color: "#FF0880" }}>{label}</span>
        </p>
        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl font-bold text-foreground border border-border"
          style={{ touchAction: "manipulation" }}
        >
          Chiudi
        </button>
      </div>
    </motion.div>
  );
}
