import { useLocation } from "wouter";
import { MapPin } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ paddingTop: "max(env(safe-area-inset-top), 24px)", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
    >
      <div className="flex flex-col items-center gap-6 max-w-xs">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,8,128,0.15)", border: "2px solid rgba(255,8,128,0.3)" }}
        >
          <MapPin size={36} style={{ color: "#FF0880" }} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-6xl font-black text-foreground">404</h1>
          <h2 className="text-xl font-bold text-foreground">Pagina non trovata</h2>
          <p className="text-sm text-muted-foreground">
            Questo posto non esiste sulla mappa.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl text-lg font-bold text-white mt-2"
          style={{ background: "linear-gradient(135deg, #FF0880 0%, #c4006e 100%)" }}
        >
          Torna alla mappa
        </button>
      </div>
    </div>
  );
}
