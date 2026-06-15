"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

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
}

const REGIONS = [
  { code: "US", label: "USD ($)" },
  { code: "IN", label: "INR (₹)" },
  { code: "EU", label: "EUR (€)" },
  { code: "GB", label: "GBP (£)" },
  { code: "CA", label: "CAD (C$)" },
  { code: "AU", label: "AUD (A$)" }
];

export default function PriceComparison({
  gameId,
  gameSlug,
  gameTitle,
  purchaseLinks,
  country = "US"
}: PriceComparisonProps) {
  const [deals, setDeals] = useState<PriceDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [region, setRegion] = useState<string>("US");

  // Load persisted region setting on mount
  useEffect(() => {
    const savedRegion = localStorage.getItem("gamegata_currency_region");
    if (savedRegion && REGIONS.some(r => r.code === savedRegion)) {
      setRegion(savedRegion);
    } else {
      const serverVal = country.toUpperCase();
      const isValid = REGIONS.some(r => r.code === serverVal);
      setRegion(isValid ? serverVal : "US");
    }
  }, [country]);

  useEffect(() => {
    async function loadPrices() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/games/${gameId}/prices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: gameTitle,
            purchaseLinks: purchaseLinks,
            country: region
          })
        });

        if (response.ok) {
          const data = await response.json();
          setDeals(data.deals || []);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load pricing info:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadPrices();
  }, [gameId, gameTitle, purchaseLinks, region]);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    localStorage.setItem("gamegata_currency_region", newRegion);
    window.dispatchEvent(new Event("gamegata_currency_updated"));
  };

  // Keep rendering skeleton while loading
  if (loading) {
    return (
      <div className="border-t border-white pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-white uppercase tracking-widest font-black">Cheapest Deals</span>
          <select 
            disabled
            value={region}
            className="font-mono text-[10px] uppercase border border-white/20 bg-black text-white/45 px-2 py-0.5 cursor-not-allowed rounded-none outline-none"
          >
            {REGIONS.map(r => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="border border-white bg-black divide-y divide-white/20">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-4 bg-white/10 w-24 rounded-none"></div>
                {i === 1 && (
                  <div className="h-4 bg-emerald-500/20 w-20 rounded-none"></div>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <div className="h-4 bg-white/10 w-16 rounded-none"></div>
                <div className="h-8 bg-white/10 w-24 rounded-none"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] text-white uppercase tracking-widest font-black">Cheapest Deals</span>
        <select 
          value={region}
          onChange={(e) => handleRegionChange(e.target.value)}
          className="font-mono text-[10px] uppercase border border-white bg-black text-white px-2 py-0.5 cursor-pointer font-bold outline-none rounded-none focus:border-white focus:ring-0"
        >
          {REGIONS.map(r => (
            <option key={r.code} value={r.code} className="bg-black text-white">{r.label}</option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="border border-red-500/30 bg-red-950/20 p-4 font-mono text-sm text-red-400 text-center uppercase tracking-wide">
          Failed to fetch current digital storefront deals.
        </div>
      ) : deals && deals.length > 0 ? (
        <div className="border border-white bg-black divide-y divide-white/20">
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
                  isCheapest ? "bg-white/5 border-l-4 border-emerald-500" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-black uppercase text-white">
                    {deal.storeName}
                  </span>
                  {isCheapest && (
                    <span className="font-mono text-[10px] bg-emerald-500 text-black px-1.5 py-0.5 font-black uppercase tracking-wider animate-pulse">
                      Best Value
                    </span>
                  )}
                  {deal.discountPercent > 0 && (
                    <span className="font-mono text-[10px] bg-white text-black px-1.5 py-0.5 font-bold uppercase">
                      -{deal.discountPercent}% OFF
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  <div className="flex items-baseline gap-2 font-mono">
                    {deal.discountPercent > 0 && (
                      <span className="text-[12px] text-white/50 line-through">
                        {formatPrice(deal.retailPrice)}
                      </span>
                    )}
                    <span className={`text-base font-black ${isCheapest ? "text-emerald-400" : "text-white"}`}>
                      {formatPrice(deal.dealPrice)}
                    </span>
                  </div>
                  
                  <a
                    href={`/re/${gameSlug}/${storeKey}?gameId=${gameId}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-mono text-[11px] uppercase tracking-wider transition-all duration-150 px-3 py-1.5 font-black flex items-center gap-1 border ${
                      isCheapest 
                        ? "bg-emerald-500 text-black border-emerald-500 hover:bg-transparent hover:text-emerald-400 hover:border-emerald-400" 
                        : "bg-transparent text-white border-white hover:bg-white hover:text-black"
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
        <div className="border border-white/20 bg-neutral-950 p-4 font-mono text-sm text-white/50 text-center uppercase tracking-wide">
          No active digital store deals found. Try checking the support links below.
        </div>
      )}
    </div>
  );
}
