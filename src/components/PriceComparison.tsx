"use client";

import { useState, useEffect } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import BrandIcon from "./icons/BrandIcon";

interface PriceDeal {
  storeName: string;
  dealPrice: number;
  retailPrice: number;
  discountPercent: number;
  dealUrl: string;
  currency?: string;
}

interface PurchaseLink {
  storeName: string;
  url: string;
}

interface PriceComparisonProps {
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  purchaseLinks: PurchaseLink[];
  country?: string;
  initialDeals?: any[];
}

const REGIONS = [
  { code: "US", label: "USD ($)" },
  { code: "IN", label: "INR (₹)" },
  { code: "EU", label: "EUR (€)" },
  { code: "GB", label: "GBP (£)" },
  { code: "CA", label: "CAD (C$)" },
  { code: "AU", label: "AUD (A$)" }
];

const PROVIDERS = [
  { code: "direct", label: "hGG Price Bot" },
  { code: "aggregated", label: "CheapShark & ITAD" }
];

export default function PriceComparison({
  gameId,
  gameSlug,
  gameTitle,
  purchaseLinks,
  country = "US",
  initialDeals = []
}: PriceComparisonProps) {
  const [deals, setDeals] = useState<PriceDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [region, setRegion] = useState<string>("detect");
  const [provider, setProvider] = useState<string>("direct");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPrices = async (targetRegion: string, targetProvider = provider, force = false, silent = false) => {
    if (force) {
      setIsRefreshing(true);
    } else if (!silent) {
      setLoading(true);
    }
    setError(false);
    try {
      const response = await fetch(`/api/games/${gameId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: gameTitle,
          purchaseLinks: purchaseLinks,
          country: targetRegion,
          forceRefresh: force,
          provider: targetProvider
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.deals && data.deals.length > 0) {
          setDeals(data.deals);
        }
        
        // If we had country set to 'detect', auto-select the detected country
        if (region === "detect" && data.country) {
          setRegion(data.country);
          localStorage.setItem("gamegata_currency_region", data.country);
        }
      } else if (!silent) {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to load pricing info:", err);
      if (!silent) setError(true);
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Resolve region and check cache or fetch on mount/region change
  useEffect(() => {
    let targetRegion = region;
    if (region === "detect") {
      const savedRegion = localStorage.getItem("gamegata_currency_region");
      if (savedRegion && REGIONS.some(r => r.code === savedRegion)) {
        setRegion(savedRegion);
        return;
      }
      targetRegion = "US"; // default fallback for cache check
    }

    // 1. Instant Cache Render (0ms UI latency)
    if (provider === "direct" && initialDeals && initialDeals.length > 0) {
      const matchingDeals = initialDeals.filter(d => d.country === targetRegion && (d.provider === "direct" || !d.provider));
      if (matchingDeals.length > 0) {
        // Sort cached deals by price ascending
        const sorted = [...matchingDeals].sort((a, b) => a.dealPrice - b.dealPrice);
        setDeals(sorted.map(d => ({
          storeName: d.storeName,
          dealPrice: d.dealPrice,
          retailPrice: d.retailPrice,
          discountPercent: d.discountPercent,
          dealUrl: d.dealUrl,
          currency: d.currency
        })));
        setLoading(false);

        // Check if cache is older than 2 hours for background SWR revalidation
        const oldestUpdate = Math.min(...matchingDeals.map(d => new Date(d.updatedAt || 0).getTime()));
        const isStale = isNaN(oldestUpdate) || oldestUpdate === 0 || (Date.now() - oldestUpdate) > 2 * 60 * 60 * 1000;
        
        // If stale or incomplete (< 2 stores), silently revalidate in the background
        if (isStale || matchingDeals.length < 2) {
          loadPrices(targetRegion, provider, false, true);
        }
        return;
      }
    }

    // 2. Otherwise (no cache), fetch dynamically with loading skeleton
    loadPrices(targetRegion, provider, false, false);
  }, [gameId, region, provider]);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    localStorage.setItem("gamegata_currency_region", newRegion);
    window.dispatchEvent(new Event("gamegata_currency_updated"));
  };

  // Keep rendering skeleton while loading
  if (loading) {
    return (
      <div className="pt-10 space-y-8">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/30 border border-white/[0.08] text-[11px] uppercase tracking-[0.18em] font-bold text-white/100">Cheapest Deals</span>
          <div className="flex items-center gap-2">
            <select 
              disabled
              value={provider}
              className="font-sans text-xs border border-white/10 bg-white/5 text-white/40 px-2 py-1 rounded-xl outline-none"
            >
              {PROVIDERS.map(p => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
            <select 
              disabled
              value={region === "detect" ? "US" : region}
              className="font-sans text-xs border border-white/10 bg-white/5 text-white/40 px-2 py-1 rounded-xl outline-none"
            >
              {REGIONS.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="border border-white/5 bg-[#131316]/50 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-4 bg-white/10 w-24 rounded-md"></div>
                {i === 1 && (
                  <div className="h-4 bg-emerald-500/10 w-20 rounded-md"></div>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <div className="h-4 bg-white/10 w-16 rounded-md"></div>
                <div className="h-8 bg-white/10 w-24 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.08] text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">Cheapest Deals</span>
          {deals.length > 0 && (
            <button
              onClick={() => loadPrices(region === "detect" ? "US" : region, provider, true)}
              disabled={isRefreshing}
              className={`text-[9px] uppercase tracking-wider px-2 py-0.5 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all flex items-center gap-1 rounded-md ${
                isRefreshing ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
              title="Query live storefronts to update price details"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh Live"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="font-sans text-xs border border-white/10 bg-white/5 text-white/70 hover:text-white px-2 py-1 cursor-pointer font-semibold outline-none rounded-xl focus:border-white/30 focus:ring-0"
          >
            {PROVIDERS.map(p => (
              <option key={p.code} value={p.code} className="bg-zinc-950 text-white">{p.label}</option>
            ))}
          </select>
          <select 
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="font-sans text-xs border border-white/10 bg-white/5 text-white px-2 py-1 cursor-pointer font-semibold outline-none rounded-xl focus:border-white/30 focus:ring-0"
          >
            {REGIONS.map(r => (
              <option key={r.code} value={r.code} className="bg-zinc-950 text-white">{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="border border-red-500/20 bg-red-950/20 p-4 font-mono text-sm text-red-400 text-center uppercase tracking-wide flex flex-col items-center gap-3 rounded-2xl">
          <span>Failed to fetch current digital storefront deals.</span>
          <button
            onClick={() => loadPrices(region === "detect" ? "US" : region, provider, true)}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black transition-all rounded-md"
          >
            Retry Fetch
          </button>
        </div>
      ) : deals && deals.length > 0 ? (
        <div className="border border-white/5 bg-[#131316]/50 rounded-2xl divide-y divide-white/5 overflow-hidden shadow-2xl">
          {deals.map((deal, idx) => {
            const isCheapest = idx === 0;
            const storeKey = deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const currencyCode = deal.currency || "USD";
            const formatPrice = (amount: number) => {
              try {
                return new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: currencyCode,
                  minimumFractionDigits: 2,
                }).format(amount);
              } catch (e) {
                return new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                }).format(amount);
              }
            };

            return (
              <div 
                key={idx}
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 transition-colors duration-150 ${
                  isCheapest ? "bg-[#10b981]/5 border-l-4 border-emerald-500" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BrandIcon name={deal.storeName} className="w-4 h-4 text-white/70 shrink-0" />
                  <span className="font-sans text-sm font-semibold text-white">
                    {deal.storeName}
                  </span>
                  {isCheapest && (
                    <span className="font-mono text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 font-bold uppercase tracking-wider rounded">
                      Best Value
                    </span>
                  )}
                  {deal.discountPercent > 0 && (
                    <span className="font-mono text-[9px] bg-white/10 text-white/80 border border-white/10 px-1.5 py-0.5 font-bold uppercase rounded">
                      -{deal.discountPercent}% OFF
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  <div className="flex items-baseline gap-2 font-mono">
                    {deal.discountPercent > 0 && (
                      <span className="text-xs text-white/40 line-through">
                        {formatPrice(deal.retailPrice)}
                      </span>
                    )}
                    <span className={`text-base font-bold ${isCheapest ? "text-emerald-400" : "text-white"}`}>
                      {formatPrice(deal.dealPrice)}
                    </span>
                  </div>
                  
                  <a
                    href={
                      provider === "direct"
                        ? `/re/${gameSlug}/${storeKey}?gameId=${gameId}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
                        : deal.dealUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs transition-all duration-150 px-3 py-1.5 font-semibold flex items-center gap-1 border rounded-xl shadow-md ${
                      isCheapest 
                        ? "bg-emerald-500 text-black border-emerald-500 hover:bg-transparent hover:text-emerald-400 hover:border-emerald-400" 
                        : "bg-white/5 text-white border-white/5 hover:bg-white hover:text-black"
                    }`}
                  >
                    <span>Go to Deal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-white/5 bg-[#131316]/50 p-6 font-mono text-xs text-white/50 text-center uppercase tracking-wide flex flex-col items-center justify-center gap-4 rounded-2xl">
          <span>No cached price details found for this region.</span>
          <button
            onClick={() => loadPrices(region === "detect" ? "US" : region, provider, true)}
            disabled={isRefreshing}
            className={`font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-white/10 text-white hover:bg-white hover:text-black transition-all flex items-center gap-2 font-black rounded-xl ${
              isRefreshing ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Fetching prices..." : "Fetch Live Prices"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
