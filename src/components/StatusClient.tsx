"use client";

import { useEffect, useState } from "react";

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

export default function StatusClient() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchStatus = async (isManual = false) => {
    if (isManual) {
      setScanning(true);
    }
    try {
      const response = await fetch("/api/status");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        throw new Error("Failed to fetch status");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (status: "ONLINE" | "OFFLINE") => {
    if (status === "ONLINE") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] tracking-wider uppercase select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ONLINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 font-semibold text-[10px] tracking-wider uppercase select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        OFFLINE
      </span>
    );
  };

  return (
    <div className="w-full flex-grow py-12 md:py-16 selection:bg-white selection:text-black flex flex-col items-center">
      <main className="max-w-3xl w-full px-6 flex flex-col gap-8 relative z-10">
        
        {/* Title Block */}
        <div className="flex flex-col gap-2 font-sans">
          <span className="text-[#ff2a2a] text-[10px] font-bold tracking-widest uppercase font-mono">SYSTEM MONITOR</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-white">
            System Status
          </h1>
          <p className="text-sm text-white/60 leading-relaxed max-w-xl">
            Live database latency, CDN performance, auth system integration, and global API endpoints check.
          </p>
        </div>

        {/* Status Card */}
        <div className="border border-white/10 bg-[#0c0c10]/60 p-6 md:p-8 rounded-2xl shadow-xl shadow-black/50 backdrop-blur-md flex flex-col gap-6 font-sans">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-white/40 uppercase tracking-wider font-semibold">
                  <th className="pb-3 pr-4">Service</th>
                  <th className="pb-3 px-4">Location</th>
                  <th className="pb-3 px-4 text-center">Speed</th>
                  <th className="pb-3 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-[13px] divide-y divide-white/5 font-medium text-white/80">
                {/* Web App */}
                <tr className="hover:bg-white/[0.01] transition-colors duration-150">
                  <td className="py-4 pr-4 font-semibold text-white uppercase text-xs">Backend Core</td>
                  <td className="py-4 px-4 text-white/50 font-normal">Global via Cloudflare</td>
                  <td className="py-4 px-4 text-center tabular-nums text-white/90">
                    {loading ? "--" : `${data?.webApp.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/45 animate-pulse text-xs">Checking...</span>
                    ) : (
                      getStatusBadge(data?.webApp.status || "ONLINE")
                    )}
                  </td>
                </tr>

                {/* Database */}
                <tr className="hover:bg-white/[0.01] transition-colors duration-150">
                  <td className="py-4 pr-4 font-semibold text-white uppercase text-xs">Game Database</td>
                  <td className="py-4 px-4 text-white/50 font-normal">Tokyo, JPN</td>
                  <td className="py-4 px-4 text-center tabular-nums text-white/90">
                    {loading ? "--" : `${data?.database.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/45 animate-pulse text-xs">Checking...</span>
                    ) : (
                      getStatusBadge(data?.database.status || "OFFLINE")
                    )}
                  </td>
                </tr>

                {/* CDN */}
                <tr className="hover:bg-white/[0.01] transition-colors duration-150">
                  <td className="py-4 pr-4 font-semibold text-white uppercase text-xs">Image Storage</td>
                  <td className="py-4 px-4 text-white/50 font-normal">Global</td>
                  <td className="py-4 px-4 text-center tabular-nums text-white/90">
                    {loading ? "--" : `${data?.cdn.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/45 animate-pulse text-xs">Checking...</span>
                    ) : (
                      getStatusBadge(data?.cdn.status || "OFFLINE")
                    )}
                  </td>
                </tr>

                {/* Catalog API */}
                <tr className="hover:bg-white/[0.01] transition-colors duration-150">
                  <td className="py-4 pr-4 font-semibold text-white uppercase text-xs">Catalogue API</td>
                  <td className="py-4 px-4 text-white/50 font-normal">Global</td>
                  <td className="py-4 px-4 text-center tabular-nums text-white/90">
                    {loading ? "--" : `${data?.catalogApi.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/45 animate-pulse text-xs">Checking...</span>
                    ) : (
                      getStatusBadge(data?.catalogApi.status || "OFFLINE")
                    )}
                  </td>
                </tr>

                {/* Auth systems */}
                <tr className="hover:bg-white/[0.01] transition-colors duration-150">
                  <td className="py-4 pr-4 font-semibold text-white uppercase text-xs">Auth Systems</td>
                  <td className="py-4 px-4 text-white/50 font-normal">Tokyo, JPN</td>
                  <td className="py-4 px-4 text-center tabular-nums text-white/90">
                    {loading ? "--" : `${data?.statsApi.latency}ms`}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {loading ? (
                      <span className="text-white/45 animate-pulse text-xs">Checking...</span>
                    ) : (
                      getStatusBadge(data?.statsApi.status || "OFFLINE")
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-4 text-[10px] text-white/40 font-mono tracking-wider">
            <span>
              {loading 
                ? "FETCHING LAST UPDATED TIMESTAMP..." 
                : `Last checked: ${data?.timestamp ? new Date(data.timestamp).toLocaleString() : "UNKNOWN"}`}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-white/60 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all duration-150 border border-white/10 px-4 py-2.5 rounded-lg select-none decoration-none"
          >
            ← Return to search
          </a>
          <button
            onClick={() => fetchStatus(true)}
            disabled={scanning || loading}
            className="flex items-center gap-2 text-xs font-semibold text-white/80 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all duration-150 border border-white/10 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            {scanning ? "Loading..." : "Refresh"}
          </button>
        </div>
      </main>
    </div>
  );
}
