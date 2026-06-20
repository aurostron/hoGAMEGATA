"use client";

import { useEffect, useState } from "react";
import ReturnButton from "@/components/ReturnButton";
import SciFiLogo from "@/components/SciFiLogo";

interface ServiceStatus {
  status: "ONLINE" | "OFFLINE";
  latency: number;
}

interface StatusData {
  webApp: ServiceStatus;
  database: ServiceStatus;
  cdn: ServiceStatus;
  catalogApi: ServiceStatus;
  statsApi: ServiceStatus;
  timestamp: string;
  cached?: boolean;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const fetchStatus = async (isManual = false) => {
    if (isManual) {
      setScanning(true);
      setConsoleLogs((prev) => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] INITIATING CONFLICT RESOLUTION RUN...`,
        `[${new Date().toLocaleTimeString()}] ENCRYPTION: ACTIVE`
      ]);
    }
    try {
      if (isManual) {
        setConsoleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] CONNECTING REGISTRY SOCKET...`]);
      }
      const response = await fetch("/api/status");
      if (response.ok) {
        const result = await response.json();
        setData(result);
        if (isManual) {
          setConsoleLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] SOCKET OK: db_latency=${result.database.latency}ms`,
            `[${new Date().toLocaleTimeString()}] ROUTING OK: cdn_latency=${result.cdn.latency}ms`,
            `[${new Date().toLocaleTimeString()}] COMPLIANCE: COMPLETE. CACHE_HIT=${result.cached ? "TRUE" : "FALSE"}`
          ]);
        }
      } else {
        throw new Error("Failed to fetch status");
      }
    } catch (err) {
      console.error(err);
      if (isManual) {
        setConsoleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] CRITICAL: TARGET PROTOCOL TIME OUT.`]);
      }
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    setConsoleLogs([
      `[${new Date().toLocaleTimeString()}] REGISTRY CONSOLE ACTIVE`,
      `[${new Date().toLocaleTimeString()}] CHECKING PORT COUPLINGS...`,
      `[${new Date().toLocaleTimeString()}] NODE DIAGNOSTIC LOG ATTACHED.`
    ]);
  }, []);

  const getStatusBadge = (status: "ONLINE" | "OFFLINE") => {
    if (status === "ONLINE") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-emerald-400 bg-emerald-950/50 text-emerald-400 font-bold text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ONLINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-red-500 bg-red-950/50 text-red-500 font-bold text-[10px]">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        OFFLINE
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black pb-24 relative overflow-hidden">
      {/* Scanline Effect Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
          backgroundSize: "100% 4px, 6px 100%"
        }}
      />

      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SciFiLogo withLink={true} />
            <div className="flex items-center gap-2 text-[10px] tracking-widest text-white/50 uppercase font-black">
              <span>System</span>
              <span>•</span>
              <span>Diagnostics</span>
              <span>•</span>
              <span>Console</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ReturnButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-12 space-y-8 relative z-10">
        <div className="flex flex-col gap-2">
          <span className="text-[#ff2a2a] text-xs font-bold tracking-widest uppercase">// SYSTEM STATUS MONITOR</span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none text-white">
            hoGAMEGATA Node Registry status
          </h1>
          <p className="text-xs text-white/60 leading-relaxed max-w-xl">
            Realtime connection polling, edge execution, and CDN caching matrices.
          </p>
        </div>

        {/* Status Table */}
        <div className="border border-white bg-neutral-950 p-6 md:p-8 shadow-[8px_8px_0px_0px_#ffffff] flex flex-col gap-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/20 text-[10px] text-white/60 uppercase tracking-widest font-black">
                  <th className="pb-3 pr-4">Node Service</th>
                  <th className="pb-3 px-4">Provider / Target</th>
                  <th className="pb-3 px-4 text-center">Latency</th>
                  <th className="pb-3 pl-4 text-right">Registry Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-white/10 font-medium">
                {/* Web App */}
                <tr className="hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="py-4 pr-4 font-bold text-white uppercase">[ Core Web App Node ]</td>
                  <td className="py-4 px-4 text-white/60">Vercel Serverless Edge</td>
                  <td className="py-4 px-4 text-center tabular-nums">
                    {loading ? "--" : `${data?.webApp.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/40 animate-pulse">[ POLLING... ]</span>
                    ) : (
                      getStatusBadge(data?.webApp.status || "ONLINE")
                    )}
                  </td>
                </tr>

                {/* PostgreSQL Database */}
                <tr className="hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="py-4 pr-4 font-bold text-white uppercase">[ Postgres Database ]</td>
                  <td className="py-4 px-4 text-white/60">Neon Serverless DB (Direct TCP)</td>
                  <td className="py-4 px-4 text-center tabular-nums">
                    {loading ? "--" : `${data?.database.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/40 animate-pulse">[ POLLING... ]</span>
                    ) : (
                      getStatusBadge(data?.database.status || "OFFLINE")
                    )}
                  </td>
                </tr>

                {/* Cloudinary CDN */}
                <tr className="hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="py-4 pr-4 font-bold text-white uppercase">[ Cloudinary CDN ]</td>
                  <td className="py-4 px-4 text-white/60">Cloudinary Global Edge CDN</td>
                  <td className="py-4 px-4 text-center tabular-nums">
                    {loading ? "--" : `${data?.cdn.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/40 animate-pulse">[ POLLING... ]</span>
                    ) : (
                      getStatusBadge(data?.cdn.status || "OFFLINE")
                    )}
                  </td>
                </tr>

                {/* Catalog API */}
                <tr className="hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="py-4 pr-4 font-bold text-white uppercase">[ Games Summary API ]</td>
                  <td className="py-4 px-4 text-white/60">/api/games/summary</td>
                  <td className="py-4 px-4 text-center tabular-nums">
                    {loading ? "--" : `${data?.catalogApi.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/40 animate-pulse">[ POLLING... ]</span>
                    ) : (
                      getStatusBadge(data?.catalogApi.status || "OFFLINE")
                    )}
                  </td>
                </tr>

                {/* Stats API */}
                <tr className="hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="py-4 pr-4 font-bold text-white uppercase">[ Registry Stats API ]</td>
                  <td className="py-4 px-4 text-white/60">/api/stats</td>
                  <td className="py-4 px-4 text-center tabular-nums">
                    {loading ? "--" : `${data?.statsApi.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/40 animate-pulse">[ POLLING... ]</span>
                    ) : (
                      getStatusBadge(data?.statsApi.status || "OFFLINE")
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/20 pt-4 text-[10px] text-white/40">
            <span>
              {loading 
                ? "FETCHING LAST UPDATED TIMESTAMP..." 
                : `LAST DIAGNOSTIC CYCLE: ${data?.timestamp ? new Date(data.timestamp).toLocaleString() : "UNKNOWN"}`}
            </span>
            {data?.cached && (
              <span className="text-amber-400 font-bold uppercase tracking-wider animate-pulse">
                [ CACHE ACTIVE — REDUCING DB STRAIN ]
              </span>
            )}
          </div>
        </div>

        {/* Diagnostic Logs console */}
        <div className="border border-white/30 bg-[#050508] p-4 font-mono text-[10px] text-white/70 space-y-1.5 max-h-48 overflow-y-auto leading-relaxed">
          <div className="text-[#ff2a2a] border-b border-white/10 pb-1.5 uppercase font-bold tracking-widest">
            // LOCAL CONSOLE DIAGNOSTIC LOGS
          </div>
          {consoleLogs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap select-text selection:bg-white selection:text-black">
              {log}
            </div>
          ))}
        </div>

        {/* Action controls */}
        <div className="flex justify-between items-center gap-4">
          <span className="text-[10px] text-white/30 font-medium tracking-wide">
            * DB connections use cached pools to prevent query saturation.
          </span>
          <button
            onClick={() => fetchStatus(true)}
            disabled={scanning || loading}
            className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-4 py-2.5 rounded-none font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:translate-y-px"
          >
            {scanning ? "[ SCROLLING MATRIX... ]" : "[ RE-SCAN SYSTEM ]"}
          </button>
        </div>
      </main>
    </div>
  );
}
