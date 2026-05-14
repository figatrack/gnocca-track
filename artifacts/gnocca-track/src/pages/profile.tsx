import { useLocation } from "wouter";
import {
  useGetUser,
  useGetUserStats,
  getGetUserQueryKey,
  getGetUserStatsQueryKey,
} from "@workspace/api-client-react";
import { getStoredUser, getTheme, setTheme, clearStoredUser } from "@/lib/storage";
import { ArrowLeft, MapPin, Star, Zap, Crown, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import appIcon from "@/assets/app-icon.png";

const BADGE_ICONS: Record<string, React.ReactNode> = {
  novizio: <Star size={20} className="text-muted-foreground" />,
  radar: <Zap size={20} style={{ color: "#FF0880" }} />,
  leggenda: <Crown size={20} style={{ color: "#FFD700" }} />,
};

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const [theme, setThemeState] = useState<"dark" | "light">(getTheme());
  const stored = getStoredUser();

  const { data: user } = useGetUser(stored?.deviceId ?? "", {
    query: {
      queryKey: getGetUserQueryKey(stored?.deviceId ?? ""),
      enabled: !!stored?.deviceId,
    },
  });

  const { data: stats } = useGetUserStats(stored?.deviceId ?? "", {
    query: {
      queryKey: getGetUserStatsQueryKey(stored?.deviceId ?? ""),
      enabled: !!stored?.deviceId,
    },
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  if (!stored) {
    navigate("/onboarding");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header
        className="flex items-center justify-between px-5 pb-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
      >
        <button onClick={() => navigate("/")} className="p-2 -ml-2 text-foreground">
          <ArrowLeft size={24} />
        </button>
        <img src={appIcon} alt="GnoccaTrack" className="h-10 w-10 object-cover rounded-2xl" />
        <button onClick={toggleTheme} className="p-2 -mr-2 text-foreground">
          {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </header>

      <div className="flex-1 px-5 pb-8 flex flex-col gap-6">
        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white"
            style={{ background: "linear-gradient(135deg, #FF0880 0%, #C8B8F8 100%)" }}
          >
            {(user?.nickname ?? stored.nickname).charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{user?.nickname ?? stored.nickname}</h2>
            {stats && (
              <div className="flex items-center justify-center gap-2 mt-1">
                {BADGE_ICONS[stats.badge]}
                <span className="text-sm font-medium text-muted-foreground">{stats.badgeLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            <MapPin size={24} style={{ color: "#FF0880" }} />
            <span className="text-3xl font-black text-foreground">{stats?.clickCount ?? 0}</span>
            <span className="text-xs text-muted-foreground font-medium">Qui Gnocca</span>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            {stats ? BADGE_ICONS[stats.badge] : <Star size={24} className="text-muted-foreground" />}
            <span className="text-lg font-bold text-foreground">{stats?.badgeLabel ?? "Novizio"}</span>
            <span className="text-xs text-muted-foreground font-medium">Livello</span>
          </div>
        </div>

        {stats && stats.recentClicks.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Ultime segnalazioni
            </h3>
            <div className="flex flex-col gap-2">
              {stats.recentClicks.map((click) => (
                <div
                  key={click.id}
                  className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "rgba(255,8,128,0.15)" }}
                    >
                      <MapPin size={14} style={{ color: "#FF0880" }} />
                    </div>
                    <span className="font-medium text-foreground text-sm">{click.venueName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(click.createdAt), { locale: it, addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => { clearStoredUser(); navigate("/onboarding"); }}
          className="mt-auto py-3 px-6 rounded-2xl border border-border text-sm font-medium text-muted-foreground"
        >
          Esci dal profilo
        </button>
      </div>
    </div>
  );
}
