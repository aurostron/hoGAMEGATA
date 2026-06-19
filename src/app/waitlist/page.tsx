"use client";

import { useState } from "react";
import SciFiLogo from "@/components/SciFiLogo";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
    <div className="min-h-screen bg-[#030303] text-[#f3f4f6] flex flex-col items-center justify-center p-6 selection:bg-white selection:text-black">
      <div className="max-w-xl w-full border-4 border-white bg-[#08080a] p-8 md:p-12 shadow-[8px_8px_0px_0px_#ffffff] flex flex-col gap-8 relative overflow-hidden">
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
          <div className="flex flex-col gap-6 animate-pulse">
            <span className="font-mono text-xs text-emerald-400 font-bold tracking-widest uppercase">
              // REGISTRATION SIGNED
            </span>
            <h1 className="font-sans font-black text-3xl sm:text-4xl uppercase tracking-tighter leading-none text-[#f3f4f6]">
              You are on the list.
            </h1>
            <p className="font-mono text-sm text-gray-400 leading-relaxed">
              We have successfully registered your email address. Once approved, we will send an access link containing login credentials to <span className="text-white font-bold">{email}</span>.
            </p>
            <div className="border border-emerald-500/20 p-4 font-mono text-xs text-emerald-400 bg-emerald-950/20 flex flex-col gap-1">
              <div>WAITLIST_STATUS: PENDING_APPROVAL</div>
              <div>DISPATCH_PROVIDER: RESEND_SECURE</div>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <div className="flex flex-col gap-6">
            <span className="font-mono text-xs text-white font-bold tracking-widest uppercase">
              // STATUS: RESTRICTED ACCESS
            </span>
            
            <div className="space-y-3">
              <h1 className="font-sans font-black text-4xl sm:text-5xl uppercase tracking-tighter leading-none text-[#f3f4f6]">
                The site is in early access.
              </h1>
              <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
                You can enter your email below to join the waitlist and request access, but approval depends on the admins and technical factors.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ENTER YOUR EMAIL ADDRESS..."
                  disabled={status === "loading"}
                  required
                  className="block w-full px-4 py-3.5 bg-black border border-white/30 text-white placeholder-white/30 text-xs font-mono tracking-wider focus:border-white focus:outline-none rounded-none transition-all duration-200 uppercase font-bold"
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
                className="px-8 py-3.5 bg-white text-black font-mono font-black text-xs tracking-widest uppercase border border-white hover:bg-transparent hover:text-white transition-all duration-150 rounded-none w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "[ REGISTERING... ]" : "[ JOIN WAITLIST ]"}
              </button>
            </form>
          </div>
        )}

        {/* Footer info block */}
        <div className="border-t border-white/10 pt-4 font-mono text-[9px] text-gray-500 uppercase tracking-widest flex justify-between items-center">
          <span>Runlevel: early_access</span>
          <span>Build: v1.0.4</span>
        </div>
      </div>
    </div>
  );
}
