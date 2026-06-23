"use client";

import { useState, useEffect } from "react";
import SciFiLogo from "@/components/SciFiLogo";

// Secret developer bypass code — only works on localhost
const DEV_BYPASS_CODE = "gamegata-dev-2026";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<{ games: number; tags: number; waitlist: number } | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [bypassStatus, setBypassStatus] = useState<"idle" | "loading" | "granted">("idle");

  useEffect(() => {
    // Check if running on localhost
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
          games: data.games ?? 2787,
          tags: data.tags ?? 54,
          waitlist: data.waitlist ?? 0,
        });
      })
      .catch((err) => {
        console.error("Failed to load waitlist stats:", err);
      });
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
            // Brief delay for visual feedback, then redirect
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

  // If bypass was granted, show a quick access-granted screen
  if (bypassStatus === "granted") {
    return (
      <div className="min-h-screen bg-[#030303] text-[#f3f4f6] flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full border-4 border-emerald-400 bg-[#08080a] p-8 shadow-[8px_8px_0px_0px_#34d399] flex flex-col gap-4 font-mono text-center">
          <div className="text-emerald-400 text-4xl">🔓</div>
          <h2 className="text-emerald-400 font-black text-xl uppercase tracking-wider">DEV ACCESS GRANTED</h2>
          <p className="text-xs text-white/50">Redirecting to app...</p>
          <div className="w-full bg-emerald-900/30 h-1 rounded overflow-hidden">
            <div className="h-full bg-emerald-400 animate-pulse" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

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
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <input
                  type={isLocalhost ? "text" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isLocalhost ? "Enter your email address..." : "Enter your email address..."}
                  disabled={status === "loading" || bypassStatus === "loading"}
                  required={!isLocalhost}
                  className={`block w-full px-4 py-3.5 bg-black border text-white placeholder-white/30 text-xs font-mono tracking-wider focus:shadow-[0_0_10px_rgba(255,255,255,0.15)] focus:outline-none rounded-none transition-all duration-200 caret-white font-bold ${
                    bypassStatus === "loading"
                      ? "border-emerald-400/60 text-emerald-300 animate-pulse"
                      : "border-white/30 focus:border-white"
                  }`}
                />
              </div>

              {status === "error" && (
                <p className="font-mono text-xs text-[#ff2a2a] uppercase tracking-wide leading-relaxed">
                  [!] ERROR: {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || bypassStatus === "loading" || !email}
                className="px-8 py-3.5 bg-white text-black font-mono font-black text-xs tracking-widest uppercase border border-white hover:bg-transparent hover:text-white hover:border-white transition-all duration-150 rounded-none w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[46px]"
              >
                {status === "loading" || bypassStatus === "loading" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    {bypassStatus === "loading" ? "[ Authenticating... ]" : "[ Registering... ]"}
                  </span>
                ) : (
                  "[ Request Early Access ]"
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
