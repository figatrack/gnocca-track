import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { markIntroShown } from "@/lib/storage";
import appIcon from "@/assets/app-icon.png";

const DURATION_MS = 4500;

interface IntroPageProps {
  onDone: () => void;
}

export default function IntroPage({ onDone }: IntroPageProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    markIntroShown();

    const start = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / DURATION_MS, 1);
      setProgress(pct);
      if (pct < 0.15) setPhase("in");
      else if (pct < 0.85) setPhase("hold");
      else setPhase("out");
      if (pct < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const skip = () => {
    setPhase("out");
    setTimeout(onDone, 350);
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "out" ? 0 : 1 }}
      transition={{ duration: 0.35 }}
      onClick={skip}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center select-none cursor-pointer overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0E0F1C 0%, #1a0d2e 50%, #0E0F1C 100%)" }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,8,128,0.35) 0%, transparent 70%)",
        }}
      />

      <FloatingParticles />

      <div className="relative flex flex-col items-center gap-6 z-10">
        <motion.div
          initial={{ scale: 0.2, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.1 }}
        >
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(255,8,128,0.3), 0 0 60px rgba(255,8,128,0.1)",
                "0 0 40px rgba(255,8,128,0.6), 0 0 100px rgba(255,8,128,0.2)",
                "0 0 20px rgba(255,8,128,0.3), 0 0 60px rgba(255,8,128,0.1)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-[2.5rem] overflow-hidden"
            style={{ width: 120, height: 120 }}
          >
            <img src={appIcon} alt="GnoccaTrack" className="w-full h-full object-cover" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-2"
        >
          <motion.h1
            className="text-4xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #FF0880 60%, #C8B8F8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            GnoccaTrack
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.95, duration: 0.6 }}
            className="text-sm text-muted-foreground font-medium tracking-widest uppercase"
          >
            Il radar della vita notturna
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.4, type: "spring", stiffness: 300, damping: 20 }}
          className="flex gap-2 mt-2"
        >
          {["bar", "pub", "club"].map((label, i) => (
            <motion.span
              key={label}
              animate={{ y: [0, -5, 0] }}
              transition={{ delay: 1.6 + i * 0.15, duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                background: "rgba(255,8,128,0.15)",
                border: "1px solid rgba(255,8,128,0.3)",
                color: "#FF0880",
              }}
            >
              {label}
            </motion.span>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <motion.div
          className="h-full"
          style={{
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #FF0880, #C8B8F8)",
            transition: "width 0.05s linear",
          }}
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-6 text-[11px] text-white/30 font-medium"
      >
        tocca per saltare
      </motion.p>
    </motion.div>
  );
}

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 4,
      })),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.id % 3 === 0 ? "#FF0880" : p.id % 3 === 1 ? "#C8B8F8" : "#ffffff",
            opacity: 0.4,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.7, 0.2],
          }}
          transition={{
            delay: p.delay,
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
