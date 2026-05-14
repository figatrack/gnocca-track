import { useState } from "react";
import { useLocation } from "wouter";
import { getDevMode, setDevMode, type DevMode } from "@/lib/storage";

export function DevSwitch() {
  const [mode, setMode] = useState<DevMode>(getDevMode());
  const [, navigate] = useLocation();

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: DevMode = mode === "user" ? "admin" : "user";
    setMode(next);
    setDevMode(next);
    if (next === "admin") {
      navigate("/admin");
    } else {
      navigate("/");
    }
  };

  return (
    <button
      onClick={toggle}
      title={`DEV: modalità attuale ${mode.toUpperCase()} — clicca per passare a ${mode === "user" ? "ADMIN" : "USER"}`}
      className="fixed z-[200] flex items-center justify-center"
      style={{
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        writingMode: "vertical-lr",
        textOrientation: "mixed",
        background: mode === "admin"
          ? "linear-gradient(180deg, #FF0880, #c4006e)"
          : "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRight: "none",
        borderRadius: "8px 0 0 8px",
        padding: "10px 5px",
        color: "white",
        fontSize: "9px",
        fontFamily: "monospace",
        fontWeight: 700,
        letterSpacing: "0.12em",
        lineHeight: 1,
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {mode === "admin" ? "ADMIN" : "USER"}
    </button>
  );
}
