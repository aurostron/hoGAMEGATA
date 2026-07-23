"use client";

import { useState, useEffect } from "react";
import SciFiLogo from "./SciFiLogo";

const DEV_BYPASS_CODE = "gamegata-dev-2026";

export default function WaitlistClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<{ games: number; tags: number; waitlist: number } | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [bypassStatus, setBypassStatus] = useState<"idle" | "loading" | "granted">("idle");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLocalhost(
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "::1"
      );

      fetch("/api/stats")
        .then((res) => {
          if (!res.ok) throw new Error("Stats load failed");
          return res.json();
        })
        .then((data) => {
          setStats({
            games: data.games ?? 2723,
            tags: data.tags ?? 34,
            waitlist: data.waitlist ?? 0,
          });
        })
        .catch((err) => {
          console.error("Failed to load waitlist stats:", err);
        });
    }
  }, []);

  // Watch email field for the secret dev bypass code
  useEffect(() => {
    if (!isLocalhost) return;
    if (email.trim() === DEV_BYPASS_CODE) {
      setBypassStatus("loading");
      fetch("/api/auth/dev-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: DEV_BYPASS_CODE }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setBypassStatus("granted");
            setTimeout(() => {
              window.location.href = "/";
            }, 800);
          } else {
            setBypassStatus("idle");
            console.error("Bypass failed:", data.error);
          }
        })
        .catch(() => setBypassStatus("idle"));
    }
  }, [email, isLocalhost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        setStatus("success");
        setStats(prev => prev ? { ...prev, waitlist: prev.waitlist + 1 } : null);
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Failed to join waitlist. Please try again.");
      }
    } catch (err) {
      console.error("Waitlist error:", err);
      setStatus("error");
      setErrorMessage("A network error occurred. Please try again.");
    }
  };

  if (bypassStatus === "granted") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 selection:bg-[#ff2a2a] selection:text-white relative">
        <div className="max-w-md w-full border-4 border-emerald-400 bg-neutral-950 p-8 shadow-[8px_8px_0px_0px_#10b981] flex flex-col gap-6 text-center">
          <span className="font-mono text-xs text-emerald-400 font-bold tracking-widest uppercase">// BYPASS RESOLVED</span>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Access Granted</h1>
          <p className="font-mono text-xs text-emerald-400 animate-pulse">BOOTING SEARCH CORE PROTOCOLS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 selection:bg-[#ff2a2a] selection:text-white relative overflow-hidden">
      {/* Scanline Effect Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
          backgroundSize: "100% 4px, 6px 100%"
        }}
      />

      <main className="max-w-lg w-full border-4 border-white bg-neutral-950 p-8 sm:p-10 shadow-[8px_8px_0px_0px_#ffffff] relative z-10 flex flex-col gap-6 select-none">
        <div className="flex flex-col items-center gap-1.5 border-b border-white/15 pb-6">
          <SciFiLogo withLink={false} />
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white/50 uppercase font-extrabold mt-1">
            <span>Early Access</span>
            <span className="text-white/40 font-black">•</span>
            <span>Horror Catalog</span>
          </div>
        </div>

        <div className="space-y-4">
          <span className="font-mono text-[10px] text-[#ff2a2a] font-bold tracking-widest uppercase block">// ACCESS RESTRICTED</span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none text-white">
            Early Access Only
          </h2>
          <p className="text-xs text-white/60 leading-relaxed font-sans font-medium">
            hoGAMEGATA early access is currently open. Sign in or join the waitlist to save games, track discounts, and organize your horror collection.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 border border-white/20 divide-x divide-white/20 font-mono text-center bg-black/40 py-3">
          <div>
            <span className="block text-base font-black text-white tabular-nums">{stats ? stats.games.toLocaleString() : "2,723"}</span>
            <span className="text-[8px] text-white/50 uppercase font-bold tracking-wider">Titles</span>
          </div>
          <div>
            <span className="block text-base font-black text-white tabular-nums">{stats ? stats.tags.toLocaleString() : "34"}</span>
            <span className="text-[8px] text-white/50 uppercase font-bold tracking-wider">Vibes</span>
          </div>
          <div>
            <span className="block text-base font-black text-white tabular-nums">
              {status === "loading" && stats ? (stats.waitlist + 1).toLocaleString() : (stats ? stats.waitlist.toLocaleString() : "--")}
            </span>
            <span className="text-[8px] text-white/50 uppercase font-bold tracking-wider">Queue</span>
          </div>
        </div>

        {status === "success" ? (
          <div className="border border-emerald-400 bg-emerald-950/20 p-4 font-mono text-xs text-emerald-400 space-y-2 text-center">
            <span className="font-black block uppercase">[ QUEUE REGISTERED ]</span>
            <p className="text-[11px] leading-relaxed">
              Vessel verified. You will receive an invitation when a slot opens.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-mono">
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter access email..."
                disabled={status === "loading" || bypassStatus === "loading"}
                className="w-full bg-black border border-white/30 focus:border-white p-3 text-xs text-white placeholder-white/30 rounded-none focus:outline-none tracking-wide"
              />
            </div>

            {status === "error" && (
              <span className="text-red-500 text-[10px] uppercase font-bold text-center block">
                [ ERROR: {errorMessage} ]
              </span>
            )}

            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="submit"
                disabled={status === "loading" || bypassStatus === "loading"}
                className="py-3 bg-white text-black font-black uppercase text-xs tracking-wider transition-all duration-150 hover:bg-black hover:text-white border border-white cursor-pointer select-none active:translate-y-px text-center"
              >
                {status === "loading" ? "[ JOINING... ]" : "[ Join Queue ]"}
              </button>

              <a
                href="/login"
                className="py-3 bg-black text-white font-black uppercase text-xs tracking-wider transition-all duration-150 hover:bg-white hover:text-black border border-white cursor-pointer select-none active:translate-y-px text-center flex items-center justify-center"
              >
                [ Sign In ]
              </a>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
