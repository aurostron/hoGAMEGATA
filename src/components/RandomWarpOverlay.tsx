import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetUrlRef = useRef<string>("/random");
  const animFrameIdRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerWarp = useCallback(async () => {
    // Respect reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      window.location.assign("/random");
      return;
    }

    setIsActive(true);
    targetUrlRef.current = "/random";

    // Fetch random game slug in parallel
    try {
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 3000);

      const res = await fetch("/api/random", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(fetchTimer);

      if (res.ok) {
        const data = await res.json();
        if (data && data.slug) {
          targetUrlRef.current = `/game/${data.slug}`;
        }
      }
    } catch {
      // Fallback stays as '/random'
    }

    // Graceful dark dissolve navigation at 1.6s
    timeoutRef.current = setTimeout(() => {
      window.location.assign(targetUrlRef.current);
    }, 1600);
  }, []);

  useEffect(() => {
    const handleCustomEvent = () => {
      if (!isActive) {
        triggerWarp();
      }
    };

    window.addEventListener("gamegata:random-warp", handleCustomEvent);

    return () => {
      window.removeEventListener("gamegata:random-warp", handleCustomEvent);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, triggerWarp]);

  // Smooth, subtle 3D starfield warp simulation
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
    const NUM_PARTICLES = width < 768 ? 160 : 260; // Clean, elegant density
    const FOV = Math.min(width, height) * 0.85;

    // Initialize 3D particles in a spacious cylindrical volume
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
    const DURATION = 1600; // ms

    // Clear initial canvas background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);

      // Smooth, silky acceleration (starts gentle, peaks gracefully, fades into dark void)
      // Eased cubic progression
      const easeInOutCubic =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentSpeed = 12 + easeInOutCubic * 88; // 12 -> 100px/frame (smooth, not harsh)

      const cx = width / 2;
      const cy = height / 2;

      // Soft persistence clear with organic motion trail
      ctx.fillStyle = "rgba(9, 9, 12, 0.22)";
      ctx.fillRect(0, 0, width, height);

      // Soft central nebula ambient glow (deep, muted, atmospheric)
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

      // Render 3D Starfield Filaments
      ctx.lineCap = "round";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.prevZ = p.z;
        p.z -= currentSpeed * p.speedMultiplier;

        // Recycle star when it passes camera
        if (p.z <= 1) {
          p.z = MAX_DEPTH;
          p.prevZ = MAX_DEPTH;
          const newDist = 30 + Math.random() * 900;
          const newAngle = Math.random() * Math.PI * 2;
          p.x = Math.cos(newAngle) * newDist;
          p.y = Math.sin(newAngle) * newDist;
        }

        // 3D Perspective Projection
        const k = FOV / p.z;
        const screenX = cx + p.x * k;
        const screenY = cy + p.y * k;

        const prevK = FOV / p.prevZ;
        const prevScreenX = cx + p.x * prevK;
        const prevScreenY = cy + p.y * prevK;

        // Skip if outside viewport bounds
        if (
          (screenX < -50 && prevScreenX < -50) ||
          (screenX > width + 50 && prevScreenX > width + 50) ||
          (screenY < -50 && prevScreenY < -50) ||
          (screenY > height + 50 && prevScreenY > height + 50)
        ) {
          continue;
        }

        // Subtle depth fading & smooth entry/exit envelope
        const depthFactor = 1 - p.z / MAX_DEPTH;
        const fadeEnvelope = Math.sin(progress * Math.PI); // Fades in smoothly and fades out smoothly
        const alpha = Math.min(
          0.85,
          Math.max(0.05, depthFactor * p.baseAlpha * (0.6 + fadeEnvelope * 0.8))
        );

        // Thin, delicate streak lines (0.8px to 2.2px max)
        const strokeWidth = Math.max(0.6, p.size * k * 0.85);

        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.min(strokeWidth, 2.4);

        ctx.beginPath();
        ctx.moveTo(prevScreenX, prevScreenY);
        ctx.lineTo(screenX, screenY);
        ctx.stroke();

        // Subtle soft point flare at head
        if (depthFactor > 0.6) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, Math.min(strokeWidth * 0.75, 1.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      // Dark Void Dissolve (Final 15% dissolves into native #0d0d0f dark theme background)
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
          <canvas
            ref={canvasRef}
            className="w-full h-full block cursor-wait"
            style={{ display: "block" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
