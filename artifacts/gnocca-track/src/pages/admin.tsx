import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetAdminStats,
  useGetAdminConfig,
  useUpdateAdminConfig,
  useAdminListHotspots,
  useAdminListUsers,
  useAdminDeleteHotspot,
  useAdminBlockUser,
  useAdminUnblockUser,
  useAdminUpdateHotspot,
  getGetAdminStatsQueryKey,
  getGetAdminConfigQueryKey,
  getAdminListHotspotsQueryKey,
  getAdminListUsersQueryKey,
} from "@workspace/api-client-react";
import type { AdminConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Ban, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import appIcon from "@/assets/app-icon.png";

type Tab = "stats" | "config" | "hotspots" | "users";

type ConfigEdit = Partial<Pick<
  AdminConfig,
  "clickDurationMinutes" | "clickCooldownMinutes" | "maxVenuesShown" | "defaultRadiusMeters" | "appTextMainButton"
>>;

export default function AdminPage() {
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [tab, setTab] = useState<Tab>("stats");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configEdit, setConfigEdit] = useState<ConfigEdit>({});
  const adminRequest = adminPin ? { headers: { "x-admin-pin": adminPin } } : undefined;

  const { data: stats } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey(), enabled: authed },
    request: adminRequest,
  });
  const { data: config } = useGetAdminConfig({
    query: { queryKey: getGetAdminConfigQueryKey(), enabled: authed },
    request: adminRequest,
  });
  const { data: hotspots } = useAdminListHotspots({
    query: { queryKey: getAdminListHotspotsQueryKey(), enabled: authed },
    request: adminRequest,
  });
  const { data: users } = useAdminListUsers({
    query: { queryKey: getAdminListUsersQueryKey(), enabled: authed },
    request: adminRequest,
  });

  const updateConfig = useUpdateAdminConfig({ request: adminRequest });
  const deleteHotspot = useAdminDeleteHotspot({ request: adminRequest });
  const blockUser = useAdminBlockUser({ request: adminRequest });
  const unblockUser = useAdminUnblockUser({ request: adminRequest });
  const updateHotspot = useAdminUpdateHotspot({ request: adminRequest });

  const handleAuth = async () => {
    const pin = inputPin.trim();
    if (!pin) {
      toast({ title: "Inserisci il PIN admin" });
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/admin/config", {
        headers: { "x-admin-pin": pin },
      });
    } catch {
      toast({ title: "API admin non raggiungibile" });
      return;
    }

    if (response.ok) {
      setAdminPin(pin);
      setAuthed(true);
      return;
    }

    if (response.status === 503) {
      toast({ title: "ADMIN_PIN non configurato sul server" });
      return;
    }

    toast({ title: "PIN errato" });
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <img src={appIcon} alt="GnoccaTrack" className="w-16 h-16 rounded-3xl" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Area Admin</h1>
              <p className="text-sm text-muted-foreground mt-1">Inserisci il PIN admin</p>
            </div>
          </div>
          <input
            type="password"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            placeholder="PIN admin"
            className="w-full bg-card border border-border rounded-2xl px-5 py-4 text-lg text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
          />
          <button
            onClick={handleAuth}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white"
            style={{ background: "linear-gradient(135deg, #FF0880 0%, #c4006e 100%)" }}
          >
            Accedi
          </button>
          <button onClick={() => navigate("/")} className="text-sm text-muted-foreground text-center">
            Torna alla mappa
          </button>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "stats", label: "Statistiche" },
    { key: "config", label: "Config" },
    { key: "hotspots", label: "Hotspot" },
    { key: "users", label: "Utenti" },
  ];

  const handleSaveConfig = async () => {
    if (!config || Object.keys(configEdit).length === 0) return;
    try {
      await updateConfig.mutateAsync({ data: configEdit });
      queryClient.invalidateQueries({ queryKey: getGetAdminConfigQueryKey() });
      toast({ title: "Config salvata" });
      setConfigEdit({});
    } catch {
      toast({ title: "Errore nel salvataggio" });
    }
  };

  const configFields: {
    key: keyof Pick<AdminConfig, "clickDurationMinutes" | "clickCooldownMinutes" | "maxVenuesShown" | "defaultRadiusMeters">;
    label: string;
    min: number;
    max: number;
  }[] = [
    { key: "clickDurationMinutes", label: "Durata click (minuti)", min: 1, max: 240 },
    { key: "clickCooldownMinutes", label: "Cooldown click (minuti)", min: 1, max: 240 },
    { key: "maxVenuesShown", label: "Venue massimi mostrati", min: 1, max: 20 },
    { key: "defaultRadiusMeters", label: "Raggio default (metri)", min: 50, max: 5000 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header
        className="flex items-center gap-4 px-5 pb-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
      >
        <button onClick={() => navigate("/")} className="p-2 -ml-2 text-foreground">
          <ArrowLeft size={24} />
        </button>
        <img src={appIcon} alt="GnoccaTrack" className="h-8 w-8 rounded-xl" />
        <h1 className="text-xl font-bold text-foreground">Admin</h1>
      </header>

      <div className="flex gap-2 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? "text-white" : "bg-card border border-border text-muted-foreground"
            }`}
            style={tab === t.key ? { background: "linear-gradient(135deg, #FF0880, #c4006e)" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 overflow-y-auto" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 32px)" }}>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {tab === "stats" && stats && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Utenti", value: stats.totalUsers },
                { label: "Click totali", value: stats.totalClicks },
                { label: "Hotspot attivi", value: stats.activeHotspots },
                { label: "Click oggi", value: stats.clicksToday },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-3xl font-black text-foreground">{value}</span>
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
              ))}
            </div>
            {stats.topVenues.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Top Venue</h3>
                {stats.topVenues.map((v, i) => (
                  <div key={v.venueName} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white"
                        style={{ backgroundColor: "#FF0880" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">{v.venueName}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: "#FF0880" }}>{v.clickCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Config ────────────────────────────────────────────────────── */}
        {tab === "config" && config && (
          <div className="flex flex-col gap-4">
            {configFields.map(({ key, label, min, max }) => {
              const currentVal = (configEdit[key] as number | undefined) ?? (config[key] as number);
              return (
                <div key={key} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-foreground">{label}</label>
                    <span className="text-lg font-black" style={{ color: "#FF0880" }}>{currentVal}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={currentVal}
                    onChange={(e) =>
                      setConfigEdit((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="w-full accent-primary"
                  />
                </div>
              );
            })}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">Testo pulsante principale</label>
              <input
                type="text"
                value={
                  // Use !== undefined so that an empty string ("") is preserved
                  configEdit.appTextMainButton !== undefined
                    ? configEdit.appTextMainButton
                    : config.appTextMainButton
                }
                onChange={(e) =>
                  setConfigEdit((prev) => ({ ...prev, appTextMainButton: e.target.value }))
                }
                className="bg-background border border-border rounded-xl px-4 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={updateConfig.isPending || Object.keys(configEdit).length === 0}
              className="w-full py-4 rounded-2xl font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #FF0880, #c4006e)" }}
            >
              {updateConfig.isPending ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        )}

        {/* ── Hotspots ──────────────────────────────────────────────────── */}
        {tab === "hotspots" && (
          <div className="flex flex-col gap-3">
            {(hotspots ?? []).map((h) => (
              <div key={h.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{h.venueName}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.city}{h.area ? ` · ${h.area}` : ""}
                      {h.isSeed ? " · Seed" : ""}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await deleteHotspot.mutateAsync({ id: h.id });
                      queryClient.invalidateQueries({ queryKey: getAdminListHotspotsQueryKey() });
                    }}
                    className="p-2 text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={h.intensity}
                    onChange={async (e) => {
                      await updateHotspot.mutateAsync({
                        id: h.id,
                        data: { intensity: e.target.value as "low" | "medium" | "high" | "bomb" },
                      });
                      queryClient.invalidateQueries({ queryKey: getAdminListHotspotsQueryKey() });
                    }}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
                  >
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="bomb">Bomb</option>
                  </select>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      h.isActive
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {h.isActive ? "Attivo" : "Inattivo"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{h.clickCount} click</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Users ─────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="flex flex-col gap-3">
            {(users ?? []).map((u) => (
              <div
                key={u.id}
                className={`bg-card border rounded-2xl p-4 flex items-center justify-between ${
                  u.isBlocked ? "border-red-500/30" : "border-border"
                }`}
              >
                <div>
                  <p className="font-semibold text-foreground text-sm">{u.nickname}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.clickCount} click ·{" "}
                    <span className={u.isBlocked ? "text-red-400 font-semibold" : "text-green-400 font-semibold"}>
                      {u.isBlocked ? "Bloccato" : "Attivo"}
                    </span>
                  </p>
                </div>
                {u.isBlocked ? (
                  <button
                    onClick={async () => {
                      await unblockUser.mutateAsync({ id: u.id });
                      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
                      toast({ title: `${u.nickname} sbloccato` });
                    }}
                    className="p-2 text-green-400"
                    title="Sblocca utente"
                  >
                    <ShieldCheck size={18} />
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await blockUser.mutateAsync({ id: u.id });
                      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
                      toast({ title: `${u.nickname} bloccato` });
                    }}
                    className="p-2 text-destructive"
                    title="Blocca utente"
                  >
                    <Ban size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
