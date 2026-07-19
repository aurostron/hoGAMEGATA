import React, { useState, useEffect, useRef } from "react";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  roles: string[];
  image: string | null;
  rawgSlug: string;
}

interface CinematicCreditsRollProps {
  title: string;
  rawgSlug?: string | null;
  developerName?: string | null;
  releaseYear?: string | number | null;
}

function getRoleColorClass(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("director") || r.includes("lead") || r.includes("producer") || r.includes("creator")) {
    return "text-red-400/90";
  }
  if (r.includes("writer") || r.includes("story") || r.includes("narrative") || r.includes("script")) {
    return "text-amber-300/90";
  }
  if (r.includes("composer") || r.includes("music") || r.includes("audio") || r.includes("sound")) {
    return "text-sky-300/90";
  }
  if (r.includes("art") || r.includes("designer") || r.includes("graphic") || r.includes("animat")) {
    return "text-emerald-300/90";
  }
  if (r.includes("program") || r.includes("code") || r.includes("engine") || r.includes("tech")) {
    return "text-purple-300/90";
  }
  return "text-neutral-400";
}

export default function CinematicCreditsRoll({
  title,
  rawgSlug,
  developerName,
  releaseYear
}: CinematicCreditsRollProps) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [showStaticList, setShowStaticList] = useState(false);

  const scrollOffsetRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCredits() {
      try {
        const params = new URLSearchParams();
        if (rawgSlug) params.set("rawgSlug", rawgSlug);
        if (title) params.set("title", title);

        const res = await fetch(`/api/game/credits?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.team && Array.isArray(data.team)) {
            setTeam(data.team);
          }
        }
      } catch (err) {
        console.error("Failed to load game credits:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCredits();
    return () => {
      isMounted = false;
    };
  }, [title, rawgSlug]);

  // 100% GPU-Accelerated 60fps Subpixel Smooth Auto-Scroll Loop
  useEffect(() => {
    if (!isPlaying || isPaused || showStaticList) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      return;
    }

    let lastTime = performance.now();

    const step = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      // GPU subpixel scroll progression: ~50px per second at 1x
      const scrollDelta = (50 * speed * delta) / 1000;
      scrollOffsetRef.current += scrollDelta;

      const contentEl = contentRef.current;
      if (contentEl) {
        contentEl.style.transform = `translate3d(0, ${-scrollOffsetRef.current}px, 0)`;

        const maxScroll = contentEl.scrollHeight - window.innerHeight + 150;
        if (scrollOffsetRef.current >= maxScroll) {
          setTimeout(() => setIsPaused(true), 1200);
        } else {
          animationFrameId.current = requestAnimationFrame(step);
        }
      }
    };

    animationFrameId.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isPlaying, isPaused, speed, showStaticList]);

  // Keyboard shortcuts (ESC to close, Space to pause/play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === "Escape") {
        closeRoll();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  const startRoll = () => {
    scrollOffsetRef.current = 0;
    setIsPlaying(true);
    setIsPaused(false);
    setShowStaticList(false);
    setSpeed(1);
    if (contentRef.current) {
      contentRef.current.style.transform = `translate3d(0, 0px, 0)`;
    }
  };

  const closeRoll = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setShowStaticList(false);
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
  };

  // Mouse wheel scrubbing for smooth manual scroll control
  const handleWheel = (e: React.WheelEvent) => {
    if (showStaticList) return;
    scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current + e.deltaY * 0.85);
    if (contentRef.current) {
      contentRef.current.style.transform = `translate3d(0, ${-scrollOffsetRef.current}px, 0)`;
    }
  };

  if (loading || team.length === 0) {
    return null; // Gracefully hide button if game has no credit data
  }

  return (
    <>
      {/* Trigger Button in Hero Metadata */}
      <button
        onClick={startRoll}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:border-amber-400/50 text-[11px] font-mono text-neutral-300 hover:text-white transition-all cursor-pointer group shadow-sm hover:shadow-amber-500/10"
        title="Play interactive in-game credit roll"
      >
        <span className="text-white-400 group-hover:scale-110 transition-transform duration-200">▶</span>
        <span>Roll the Credits!</span>
        <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] text-white/70">
          {team.length}
        </span>
      </button>

      {/* Full-Screen Cinematic Viewport */}
      {isPlaying && (
        <div
          className="fixed inset-0 z-[100] bg-[#050505] text-white overflow-hidden select-none animate-in fade-in duration-300"
          onWheel={handleWheel}
        >
          {/* Subtle Dark Radial Vignette Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.85)_100%)] z-10" />

          {/* Clean Top Exit Button */}
          <div className="absolute top-6 right-6 z-20 flex items-center justify-end pointer-events-auto font-mono text-xs text-neutral-400">
            <button
              onClick={closeRoll}
              className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg"
            >
              <span>Exit</span>
              <span className="text-neutral-400 text-[10px]">[ESC]</span>
            </button>
          </div>

          {/* Static List Mode (if toggled) */}
          {showStaticList ? (
            <div className="relative z-10 max-w-4xl mx-auto h-full overflow-y-auto pt-24 pb-32 px-6">
              <div className="text-center mb-12 space-y-2">
                <h2 className="text-3xl sm:text-5xl font-serif font-black uppercase tracking-[0.2em] text-white">
                  {title}
                </h2>
                <p className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                  Full Team List — {team.length} Members
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {team.map((person) => (
                  <div
                    key={person.id}
                    className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-1.5"
                  >
                    <div className="text-sm font-bold text-white">{person.name}</div>
                    <div className={`font-mono text-[10px] uppercase tracking-wider ${getRoleColorClass(person.role)}`}>
                      {person.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* 100% GPU-Accelerated Subpixel Smooth Auto-Scroll Canvas */
            <div className="relative z-0 w-full h-full overflow-hidden">
              <div
                ref={contentRef}
                className="max-w-2xl mx-auto text-center space-y-28 pt-[50vh] pb-[60vh] px-6"
                style={{
                  willChange: "transform",
                  transform: "translate3d(0, 0px, 0)"
                }}
                onClick={() => setIsPaused((prev) => !prev)}
              >
                {/* Game Title Header */}
                <div className="space-y-4 pt-12 pb-16">
                  <h1 className="text-5xl sm:text-7xl font-serif font-black uppercase tracking-[0.25em] text-white leading-tight filter drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
                    {title}
                  </h1>
                  {developerName && (
                    <div className="font-mono text-xs text-neutral-400 uppercase tracking-[0.3em]">
                      Developed by {developerName} {releaseYear ? `(${releaseYear})` : ""}
                    </div>
                  )}
                  <div className="w-12 h-0.5 bg-white/20 mx-auto mt-8" />
                </div>

                {/* Team Credit Blocks */}
                <div className="space-y-20">
                  {team.map((person) => (
                    <div key={person.id} className="space-y-2.5 group">
                      <div
                        className={`font-mono text-xs uppercase tracking-[0.35em] font-bold ${getRoleColorClass(
                          person.role
                        )}`}
                      >
                        {person.role}
                      </div>

                      {person.image && (
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden border border-white/20 p-0.5 bg-white/5">
                          <img
                            src={person.image}
                            alt={person.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        </div>
                      )}

                      <div className="text-2xl sm:text-4xl font-extrabold text-white tracking-wide font-sans">
                        {person.name}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Closing Thanks */}
                <div className="pt-24 space-y-6">
                  <div className="w-16 h-0.5 bg-white/20 mx-auto" />
                  <div className="font-mono text-xs text-neutral-400 uppercase tracking-[0.4em]">
                    THANK YOU FOR PLAYING
                  </div>
                  <div className="text-xs text-neutral-600 font-mono">
                    {title} © {developerName || "All Rights Reserved"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Floating Minimalist Control Dock */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 border border-white/15 backdrop-blur-md shadow-2xl font-mono text-xs">
            {!showStaticList ? (
              <>
                {/* Play/Pause */}
                <button
                  onClick={() => setIsPaused((prev) => !prev)}
                  className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{isPaused ? "▶ Play" : "❚❚ Pause"}</span>
                </button>

                <div className="w-px h-4 bg-white/15 mx-1" />

                {/* Speed Toggle */}
                <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5 border border-white/10">
                  {([1, 2, 4] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSpeed(s);
                        setIsPaused(false);
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        speed === s
                          ? "bg-white text-black"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <div className="w-px h-4 bg-white/15 mx-1" />

                {/* Switch to List View */}
                <button
                  onClick={() => setShowStaticList(true)}
                  className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors cursor-pointer"
                >
                  View all credits
                </button>
              </>
            ) : (
              /* Switch Back to Roll Mode */
              <button
                onClick={() => {
                  setShowStaticList(false);
                  setIsPaused(false);
                  scrollOffsetRef.current = 0;
                  if (contentRef.current) {
                    contentRef.current.style.transform = `translate3d(0, 0px, 0)`;
                  }
                }}
                className="px-4 py-1.5 rounded-full bg-white text-black font-bold hover:bg-neutral-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>▶ Roll the Credits?</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
