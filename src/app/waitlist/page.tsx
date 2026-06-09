"use client";

import { useState, useEffect } from "react";
import SciFiLogo from "@/components/SciFiLogo";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<{ games: number; tags: number; waitlist: number } | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Stats load failed");
        return res.json();
      })
      .then((data) => {
        setStats({
          games: data.games ?? 2787,
          tags: data.tags ?? 54,
          waitlist: data.waitlist ?? 0,
        });
      })
      .catch((err) => {
        console.error("Failed to load waitlist stats:", err);
      });
  }, []);

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
        // Increment waitlist count dynamically for instant feedback
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

  return (
    <div className="min-h-screen bg-[#030303] text-[#f3f4f6] flex flex-col items-center justify-center p-6 selection:bg-red-600/30 selection:text-white relative overflow-hidden">
      {/* Scanline Effect Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
        style={{
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
          backgroundSize: "100% 4px, 6px 100%"
        }}
      />

      <div className="max-w-2xl w-full border-4 border-white bg-[#08080a] p-8 md:p-12 shadow-[8px_8px_0px_0px_#ffffff] flex flex-col gap-8 relative overflow-hidden">
        {/* Top brand header */}
        <div className="flex flex-col gap-2 pb-4 border-b border-white/10">
          <SciFiLogo withLink={false} />
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/50 uppercase font-bold">
            <span>Horror</span>
            <span className="text-white/30 font-black">•</span>
            <span>Game</span>
            <span className="text-white/30 font-black">•</span>
            <span>Mega</span>
            <span className="text-white/30 font-black">•</span>
            <span>Metadata</span>
          </div>
        </div>

        {status === "success" ? (
          /* Success Screen */
          <div className="flex flex-col gap-6">
            <span className="font-mono text-xs text-emerald-400 font-bold tracking-widest uppercase flex items-center gap-2">
              Request Sent
            </span>
            <h1 className="font-sans font-black text-4xl sm:text-5xl uppercase tracking-tighter leading-none text-[#f3f4f6]">
              You are on the list.
            </h1>
            <p className="font-sans text-sm text-gray-300 leading-relaxed">
              We have successfully registered your email address. Once approved, we will send an access link containing login credentials to <span className="text-white font-bold">{email}</span>.
            </p>
            <div className="border border-emerald-500/20 p-4 font-mono text-xs text-emerald-400 bg-emerald-950/20 flex flex-col gap-1">
              <div>Waitlist status: Pending Approval</div>
              <div>Dispatch: Resend Secure</div>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <div className="flex flex-col gap-6">
            <span className="font-mono text-xs text-white font-bold tracking-widest uppercase flex items-center gap-2">
              STATUS: <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" /> RESTRICTED ACCESS
            </span>
            
            <div className="space-y-4">
              <h1 className="font-sans font-black text-5xl sm:text-6xl uppercase tracking-tighter leading-none text-[#f3f4f6]">
                THE HORROR GAME DATABASE.
              </h1>
              <div className="font-sans text-sm text-white/70 space-y-2 leading-relaxed">
                <p>Thousands of horror games. Metadata, scare ratings, community reviews, and hidden gems you won't find elsewhere.</p>
                <p className="text-white font-mono text-xs tracking-wider uppercase font-bold pt-2">Join the waitlist for early access.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  disabled={status === "loading"}
                  required
                  className="block w-full px-4 py-3.5 bg-black border border-white/30 text-white placeholder-white/30 text-xs font-mono tracking-wider focus:border-white focus:shadow-[0_0_10px_rgba(255,255,255,0.15)] focus:outline-none rounded-none transition-all duration-200 caret-white font-bold"
                />
              </div>

              {status === "error" && (
                <p className="font-mono text-xs text-[#ff2a2a] uppercase tracking-wide leading-relaxed">
                  [!] ERROR: {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !email}
                className="px-8 py-3.5 bg-white text-black font-mono font-black text-xs tracking-widest uppercase border border-white hover:bg-transparent hover:text-white hover:border-white transition-all duration-150 rounded-none w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[46px]"
              >
                {status === "loading" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    [ Registering... ]
                  </span>
                ) : (
                  "[ Join Waitlist ]"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Live Social Proof Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-6 select-none">
          <div className="border border-white/10 p-3 bg-black/40 flex flex-col items-center justify-center gap-1 font-mono text-center">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Database Size</span>
            <span className="text-xs font-bold text-white tracking-wider">
              {stats ? stats.games.toLocaleString() : "---"} GAMES INDEXED
            </span>
          </div>
          <div className="border border-white/10 p-3 bg-black/40 flex flex-col items-center justify-center gap-1 font-mono text-center">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Early Access</span>
            <span className="text-xs font-bold text-white tracking-wider">
              {stats ? stats.waitlist.toLocaleString() : "---"} WAITING
            </span>
          </div>
          <div className="border border-white/10 p-3 bg-black/40 flex flex-col items-center justify-center gap-1 font-mono text-center">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Custom game tags</span>
            <span className="text-xs font-bold text-white tracking-wider">
              {stats ? stats.tags.toLocaleString() : "---"}
            </span>
          </div>
        </div>

        {/* Footer info block */}
        <div className="border-t border-white/10 pt-4 font-mono text-[9px] text-gray-500 uppercase tracking-widest flex flex-col sm:flex-row justify-between items-center w-full gap-2">
          <span>© hoGAMEGATA</span>
          <span>•</span>
          <span>Indexing since 2026</span>
        </div>
      </div>
    </div>
  );
}
