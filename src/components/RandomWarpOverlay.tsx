import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FALLBACK_RANDOM_GAMES, type RandomGameItem } from "../data/randomPool";

/* ──────────────────────────────────────────────
   Atmospheric Starfield & Subtle Cosmic Void Palette
   Soft, cinematic, easy on the eyes (no harsh neon glares)
   ────────────────────────────────────────────── */
interface StarParticle {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  color: string;
  baseAlpha: number;
  speedMultiplier: number;
}

const COSMIC_PALETTE = [
  { r: 240, g: 244, b: 255, alpha: 0.65 }, // Soft starlight white
  { r: 200, g: 220, b: 255, alpha: 0.55 }, // Pale ethereal blue
  { r: 220, g: 38, b: 38, alpha: 0.5 },   // Muted horror crimson (accent)
  { r: 168, g: 85, b: 247, alpha: 0.45 }, // Deep cosmic violet
  { r: 255, g: 255, b: 255, alpha: 0.75 }, // Core point light
  { r: 147, g: 197, b: 253, alpha: 0.4 },  // Soft nebula azure
];

export default function RandomWarpOverlay() {
  const [isActive, setIsActive] = useState(false);
  const [selectedGame, setSelectedGame] = useState<RandomGameItem | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // 1. Global Event Listener (mounted once, never cancels navigation timers)
  useEffect(() => {
    const handleWarp = (e: Event) => {
      const customEvent = e as CustomEvent<{ slug?: string; title?: string }>;
      let game = customEvent.detail;
      if (!game || !game.slug) {
        const pool =
          FALLBACK_RANDOM_GAMES.length > 0
            ? FALLBACK_RANDOM_GAMES
            : [{ slug: "silent-hill-2", title: "Silent Hill 2" }];
        const randomIndex = Math.floor(Math.random() * pool.length);
        game = pool[randomIndex];
      }

      // Respect reduced motion preference
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        window.location.assign(`/game/${game.slug}`);
        return;
      }

      // Prefetch target document immediately at t=0ms
      try {
        const prefetchLink = document.createElement("link");
        prefetchLink.rel = "prefetch";
        prefetchLink.href = `/game/${game.slug}`;
        document.head.appendChild(prefetchLink);
      } catch {}

      setSelectedGame(game);
      setIsActive(true);
    };

    const handlePageHide = () => setIsActive(false);
    const handlePageShow = () => setIsActive(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsActive(false);
      }
    };

    window.addEventListener("gamegata:random-warp", handleWarp);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("gamegata:random-warp", handleWarp);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 2. Navigation Lifecycle: triggered exclusively when isActive becomes true
  useEffect(() => {
    if (!isActive || !selectedGame) return;

    // Navigate at 1050ms during the smooth dark dissolve
    const navTimer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.assign(`/game/${selectedGame.slug}`);
      }
    }, 1050);

    // Failsafe auto-dismiss at 3500ms so screen is never trapped
    const failsafeTimer = setTimeout(() => {
      setIsActive(false);
    }, 3500);

    return () => {
      clearTimeout(navTimer);
      clearTimeout(failsafeTimer);
    };
  }, [isActive, selectedGame]);

  // 3. Smooth 3D Canvas Warp Animation
  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const MAX_DEPTH = 1400;
    const NUM_PARTICLES = width < 768 ? 160 : 260;
    const FOV = Math.min(width, height) * 0.85;

    const particles: StarParticle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const palette = COSMIC_PALETTE[Math.floor(Math.random() * COSMIC_PALETTE.length)];
      const dist = 40 + Math.random() * 900;
      const angle = Math.random() * Math.PI * 2;
      const z = Math.random() * MAX_DEPTH;

      particles.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        z: z,
        prevZ: z,
        size: 0.8 + Math.random() * 1.6,
        color: `rgb(${palette.r}, ${palette.g}, ${palette.b})`,
        baseAlpha: palette.alpha,
        speedMultiplier: 0.85 + Math.random() * 0.35,
      });
    }

    const startTime = performance.now();
    const DURATION = 1500; // ms

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);

      const easeInOutCubic =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentSpeed = 12 + easeInOutCubic * 88;

      const cx = width / 2;
      const cy = height / 2;

      ctx.fillStyle = "rgba(9, 9, 12, 0.24)";
      ctx.fillRect(0, 0, width, height);

      // Ambient core glow
      const coreRadius = Math.min(width, height) * (0.2 + progress * 0.35);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
      const glowOpacity = Math.sin(progress * Math.PI) * 0.25;
      gradient.addColorStop(0, `rgba(220, 38, 38, ${glowOpacity * 0.4})`);
      gradient.addColorStop(0.4, `rgba(139, 92, 246, ${glowOpacity * 0.25})`);
      gradient.addColorStop(0.8, `rgba(9, 9, 12, ${glowOpacity * 0.1})`);
      gradient.addColorStop(1, "transparent");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = "round";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.prevZ = p.z;
        p.z -= currentSpeed * p.speedMultiplier;

        if (p.z <= 1) {
          p.z = MAX_DEPTH;
          p.prevZ = MAX_DEPTH;
          const newDist = 30 + Math.random() * 900;
          const newAngle = Math.random() * Math.PI * 2;
          p.x = Math.cos(newAngle) * newDist;
          p.y = Math.sin(newAngle) * newDist;
        }

        const k = FOV / p.z;
        const screenX = cx + p.x * k;
        const screenY = cy + p.y * k;

        const prevK = FOV / p.prevZ;
        const prevScreenX = cx + p.x * prevK;
        const prevScreenY = cy + p.y * prevK;

        if (
          (screenX < -50 && prevScreenX < -50) ||
          (screenX > width + 50 && prevScreenX > width + 50) ||
          (screenY < -50 && prevScreenY < -50) ||
          (screenY > height + 50 && prevScreenY > height + 50)
        ) {
          continue;
        }

        const depthFactor = 1 - p.z / MAX_DEPTH;
        const fadeEnvelope = Math.sin(progress * Math.PI);
        const alpha = Math.min(
          0.85,
          Math.max(0.05, depthFactor * p.baseAlpha * (0.6 + fadeEnvelope * 0.8))
        );

        const strokeWidth = Math.max(0.6, p.size * k * 0.85);

        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.min(strokeWidth, 2.4);

        ctx.beginPath();
        ctx.moveTo(prevScreenX, prevScreenY);
        ctx.lineTo(screenX, screenY);
        ctx.stroke();

        if (depthFactor > 0.6) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, Math.min(strokeWidth * 0.75, 1.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      // Dark Void Dissolve (Final 15%)
      if (progress > 0.82) {
        const darkFade = (progress - 0.82) / 0.18;
        ctx.fillStyle = `rgba(13, 13, 15, ${darkFade * darkFade})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (progress < 1) {
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isActive]);

  const handleCancel = () => {
    setIsActive(false);
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="random-warp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] pointer-events-auto select-none overflow-hidden bg-[#09090b]"
          style={{ willChange: "opacity" }}
        >
          {/* 3D Canvas Background */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block cursor-wait"
          />

          {/* Cinematic Horror Discovery HUD */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-4">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-center max-w-lg"
            >
              <span className="inline-block text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-red-400 uppercase drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] mb-2">
                Summoning
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white/95 drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)] line-clamp-2">
                {selectedGame?.title || "Exploring the Abyss..."}
              </h2>
            </motion.div>
          </div>

          {/* Subtle Cancel Button in Top Right */}
          <button
            type="button"
            onClick={handleCancel}
            className="absolute top-5 right-5 z-20 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/70 border border-white/10 text-white/60 hover:text-white text-xs font-medium tracking-wide transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
