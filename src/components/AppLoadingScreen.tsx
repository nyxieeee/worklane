import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import sidebarDark from "../assets/sidebar-dark.png";
import sidebarLight from "../assets/sidebar.png";
import ThreeDBackground from "./ThreeDBackground";

interface AppLoadingScreenProps {
  isDark?: boolean;
}

export default function AppLoadingScreen({ isDark = true }: AppLoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const steps = [
      { target: 30, delay: 0 },
      { target: 55, delay: 300 },
      { target: 75, delay: 700 },
      { target: 85, delay: 1300 },
    ];
    const timers: number[] = steps.map(({ target, delay }) =>
      window.setTimeout(() => setProgress(target), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const accent = "#6366f1";
  const sub = isDark ? "#94a3b8" : "#475569";
  const logoSrc = isDark ? sidebarDark : sidebarLight;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: isDark ? "#070b16" : "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Inter', 'Outfit', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Animated 3D ribbon background */}
      <ThreeDBackground isDark={isDark ?? true} />

      {/* Overlay to tone down background so content pops */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isDark
            ? "rgba(7, 11, 22, 0.45)"
            : "rgba(241, 245, 249, 0.45)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Loading content — sits above background */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Logo image — enlarged */}
        <motion.img
          src={logoSrc}
          alt="Worklane"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 200,
            height: 200,
            objectFit: "contain",
            borderRadius: 28,
            filter: `drop-shadow(0 0 32px ${accent}70)`,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 15,
            color: sub,
            letterSpacing: "0.04em",
            fontWeight: 500,
          }}
        >
          Syncing your workspace...
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 240,
            height: 4,
            borderRadius: 99,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              height: "100%",
              borderRadius: 99,
              background: `linear-gradient(90deg, ${accent}, #8b5cf6)`,
              boxShadow: `0 0 12px ${accent}80`,
            }}
          />
        </div>

        {/* Pulsing dots */}
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: accent }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}