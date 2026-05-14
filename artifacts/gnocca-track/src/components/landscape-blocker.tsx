import { motion } from "framer-motion";
import appIcon from "@/assets/app-icon.png";

export function LandscapeBlocker() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="landscape-only fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: "linear-gradient(160deg, #0E0F1C 0%, #1a0d2e 100%)" }}
    >
      <img
        src={appIcon}
        alt="GnoccaTrack"
        className="w-16 h-16 rounded-2xl"
        style={{ filter: "drop-shadow(0 0 20px rgba(255,8,128,0.4))" }}
      />
      <div className="flex flex-col gap-2">
        <motion.div
          animate={{ rotate: [0, -90, -90, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
          className="text-5xl mx-auto"
          style={{ transformOrigin: "center" }}
        >
          📱
        </motion.div>
        <h2 className="text-xl font-black text-white mt-2">Ruota il telefono</h2>
        <p className="text-sm text-white/60 font-medium">
          GnoccaTrack funziona solo in verticale
        </p>
      </div>
    </motion.div>
  );
}
