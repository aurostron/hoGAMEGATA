"use client";

import { useState, useEffect } from "react";
import { Star, Heart, ArrowRight, Check } from "lucide-react";
import type { HeroGameData } from "./HeroCarousel";
import PlatformLogos from "./PlatformLogos";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CartProvider, useCart } from "../context/CartContext";
import { getCloudinaryFetchUrl } from "../lib/utils";

const patrons = [
  { name: "Puppet Combo", initials: "PC", style: "border border-red-950 bg-red-950/20 text-red-500 font-bold" },
  { name: "Chilla's Art", initials: "CA", style: "border border-emerald-950 bg-emerald-950/20 text-emerald-400 font-bold" },
  { name: "Frictional Games", initials: "FG", style: "border border-amber-950 bg-amber-950/20 text-amber-500 font-bold" },
  { name: "Nightdive Studios", initials: "ND", style: "border border-blue-950 bg-blue-950/20 text-blue-400 font-bold" },
  { name: "Bloober Team", initials: "BT", style: "border border-purple-950 bg-purple-950/20 text-purple-400 font-bold" },
  { name: "Aurostron", initials: "AU", style: "border border-white/20 bg-zinc-900 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.05)]" },
  { name: "HorrorFan99", initials: "HF", style: "border border-white/10 bg-zinc-950 text-white/50" },
  { name: "SilentGamer", initials: "SG", style: "border border-white/10 bg-zinc-950 text-white/50" },
  { name: "RetroGamer", initials: "RG", style: "border border-white/10 bg-zinc-950 text-white/50" },
  { name: "AcidRain", initials: "AR", style: "border border-white/10 bg-zinc-950 text-white/50" },
  { name: "DarkMinds", initials: "DM", style: "border border-white/10 bg-zinc-950 text-white/50" },
  { name: "Entity303", initials: "E3", style: "border border-red-950 bg-zinc-950 text-red-700/60 font-mono" },
  { name: "PyramidHead", initials: "PH", style: "border border-white/10 bg-zinc-950 text-white/50" },
  { name: "VibePreserve", initials: "VP", style: "border border-violet-950 bg-violet-950/10 text-violet-400" },
  { name: "Crowbar", initials: "CB", style: "border border-white/10 bg-zinc-950 text-white/50" }
];

interface StorefrontListsProps {
  latest: HeroGameData[];
  trending: HeroGameData[];
  activeRegion: string;
  onExplore: () => void;
  catalogueTitle?: string;
  catalogueDesc?: string;
  supportTitle?: string;
  supportDesc?: string;
}

const formatPrice = (amount: number, currencyCode: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
};

export default function StorefrontLists({
  latest,
  trending,
  upcoming,
  topRated,
  activeRegion,
  onExplore,
  catalogueTitle,
  catalogueDesc,
  supportTitle,
  supportDesc
}: StorefrontListsProps) {
  const { user } = useAuth();
  const { cartItems, addToCart, removeFromCart } = useCart();

  // Extract initial images for SSR
  const initialImages = [...latest, ...trending]
    .map(g => (g.screenshots && g.screenshots.length > 0 ? g.screenshots[0] : g.coverUrl))
    .filter((img): img is string => !!img);

  const [wishedMap, setWishedMap] = useState<Record<string, boolean>>({});
  const [randomLatest, setRandomLatest] = useState<HeroGameData[]>([]);
  const [randomTrending, setRandomTrending] = useState<HeroGameData[]>([]);
  const [bgImages, setBgImages] = useState<string[]>(initialImages);
  const [currentBgIdx, setCurrentBgIdx] = useState(0);

  // Load wishlist from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      const mapped: Record<string, boolean> = {};
      if (Array.isArray(saved)) {
        saved.forEach((id: string) => {
          mapped[id] = true;
        });
      }
      setWishedMap(mapped);
    } catch { /* ignore */ }
  }, []);

  // Client-side shuffler for lists (excluding the top 7 games shown in TabCatalog)
  useEffect(() => {
    const latestPool = latest.length > 7 ? latest.slice(7) : latest;
    const trendingPool = trending.length > 7 ? trending.slice(7) : trending;

    const shuffle = (array: HeroGameData[]) => {
      return [...array].sort(() => Math.random() - 0.5);
    };

    setRandomLatest(shuffle(latestPool).slice(0, 6));
    setRandomTrending(shuffle(trendingPool).slice(0, 6));
  }, [latest, trending]);

  // Gather screenshots/covers for the banner slideshow
  useEffect(() => {
    const images: string[] = [];
    const allGames = [...latest, ...trending];
    for (const g of allGames) {
      if (g.screenshots && g.screenshots.length > 0) {
        images.push(g.screenshots[0]);
      } else if (g.coverUrl) {
        images.push(g.coverUrl);
      }
    }
    const uniqueImages = Array.from(new Set(images));
    if (uniqueImages.length > 0) {
      setBgImages(uniqueImages.sort(() => Math.random() - 0.5));
    }
  }, [latest, trending]);

  // Slideshow interval timer
  useEffect(() => {
    if (bgImages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBgIdx((prev) => (prev + 1) % bgImages.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [bgImages]);

  const toggleWish = async (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const saved: string[] = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      const isWished = wishedMap[gameId];
      const next = isWished ? saved.filter(id => id !== gameId) : [...saved, gameId];
      localStorage.setItem("gamegata_wishlist", JSON.stringify(next));
      setWishedMap(prev => ({ ...prev, [gameId]: !isWished }));

      if (user) {
        const method = isWished ? "DELETE" : "POST";
        fetch("/api/user/wishlist", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        }).catch(err => console.error("Cloud wishlist sync toggle failed:", err));
      }
    } catch { /* ignore */ }
  };

  const getCheapestDeal = (game: HeroGameData) => {
    if (!game.priceSnapshots || game.priceSnapshots.length === 0) return null;
    let regional = game.priceSnapshots.filter(p => p.country === activeRegion);
    if (regional.length === 0) {
      regional = game.priceSnapshots.filter(p => p.country === "US");
    }
    if (regional.length === 0) {
      regional = game.priceSnapshots;
    }
    if (regional.length === 0) return null;
    const sorted = [...regional].sort((a, b) => a.dealPrice - b.dealPrice);
    return sorted[0];
  };

  const leftList = randomTrending;
  const rightList = randomLatest;

  const renderListItem = (game: HeroGameData) => {
    const deal = getCheapestDeal(game);
    const hasDiscount = deal && deal.discountPercent > 0;
    const isWished = wishedMap[game.id] || false;
    const ratingDisplay = game.rating ? (game.rating / 10).toFixed(1) : null;
    const isInCart = cartItems.some(i => i.gameId === game.id);

    const storeKey = deal ? deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    const directLink = deal
      ? `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
      : `/game/${game.slug}`;

    return (
      <div
        key={game.id}
        className="group relative flex items-center justify-between p-3 border-b border-white/5 hover:bg-white/5 transition-all duration-150 gap-4"
      >
        <a href={`/game/${game.slug}`} className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Cover Art Thumbnail */}
          <div className="relative w-16 h-20 bg-neutral-900 border border-white/10 shrink-0 overflow-hidden">
            {game.coverUrl ? (
              <img
                src={getCloudinaryFetchUrl(game.coverUrl) || undefined}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-neutral-950 flex items-center justify-center font-mono text-[10px] text-white/20 select-none">
                NO ART
              </div>
            )}
          </div>

          {/* Game Title, developer & details */}
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-white group-hover:text-red-400 transition-colors uppercase tracking-wide truncate text-sm sm:text-base">
              {game.title}
            </h4>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <span className="font-mono text-[10px] sm:text-xs font-bold text-white/40 uppercase">
                {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
              </span>
              <span className="text-white/10 font-mono text-[10px] sm:text-xs select-none">·</span>
              <PlatformLogos platformNames={game.platformNames} />
              {ratingDisplay && (
                <>
                  <span className="text-white/10 font-mono text-[10px] sm:text-xs select-none">·</span>
                  <span className="flex items-center gap-0.5 font-mono text-[10px] sm:text-xs text-amber-400 font-bold">
                    <Star className="w-3 h-3 fill-current" /> {ratingDisplay}
                  </span>
                </>
              )}
            </div>
          </div>
        </a>

        {/* Pricing / Actions Section */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cart Icon Button (Visible on hover, always visible if active) */}
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isInCart) {
                await removeFromCart(game.id);
              } else {
                await addToCart(game);
                window.dispatchEvent(new Event("gamegata_open_cart"));
              }
            }}
            className={`w-8 h-8 border flex items-center justify-center transition-all duration-150 cursor-pointer rounded-none md:opacity-0 group-hover:opacity-100 focus:opacity-100
              ${isInCart
                ? "bg-[#7b3fc4]/85 border-[#7b3fc4] text-white opacity-100!"
                : "bg-black/80 border-white/25 text-white/40 hover:border-white hover:text-white"
              }`}
            title={isInCart ? "Remove from cart" : "Add to cart"}
          >
            {isInCart ? (
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            )}
          </button>

          {/* Wishlist Heart Icon (Visible on hover, always visible if active) */}
          <button
            onClick={(e) => toggleWish(e, game.id)}
            className={`w-8 h-8 border flex items-center justify-center transition-all duration-150 cursor-pointer rounded-none md:opacity-0 group-hover:opacity-100 focus:opacity-100
              ${isWished
                ? "bg-red-950/80 border-red-500 text-red-500 opacity-100!"
                : "bg-black/80 border-white/25 text-white/40 hover:border-white hover:text-white"
              }`}
            title={isWished ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className="w-4 h-4" fill={isWished ? "currentColor" : "none"} />
          </button>

          {/* Pricing blocks */}
          <div className="flex items-center gap-2">
            {deal ? (
              <>
                {hasDiscount && (
                  <span className="font-mono text-xs font-black bg-[#7b3fc4] text-white px-1.5 py-0.5 tracking-wide">
                    -{deal.discountPercent}%
                  </span>
                )}
                <div className="flex flex-col items-end justify-center font-mono">
                  <span className="text-sm sm:text-base font-black text-emerald-400 leading-none">
                    {formatPrice(deal.dealPrice, deal.currency)}
                  </span>
                  {hasDiscount && (
                    <span className="text-[10px] sm:text-xs text-white/30 line-through leading-none mt-0.5">
                      {formatPrice(deal.retailPrice, deal.currency)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="font-mono text-sm text-white/30 uppercase tracking-widest px-2">—</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-16 mt-16">
      {/* 1. Side-by-Side Bestsellers & New Releases lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        {/* Left Column: Popular Horrors */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-mono text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2.5">
              <span className="w-2 h-5 bg-red-500 inline-block" /> POPULAR HORRORS
            </h3>
            <button
              onClick={onExplore}
              className="font-mono text-xs uppercase font-bold tracking-wider text-white/45 hover:text-white transition-colors cursor-pointer"
            >
              See more
            </button>
          </div>
          <div className="bg-black/30 border border-white/5 divide-y divide-white/5">
            {leftList.map(renderListItem)}
          </div>
        </div>

        {/* Right Column: New Releases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-mono text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2.5">
              <span className="w-2 h-5 bg-red-500 inline-block" /> LATEST DEPLOYMENTS
            </h3>
            <button
              onClick={onExplore}
              className="font-mono text-xs uppercase font-bold tracking-wider text-white/45 hover:text-white transition-colors cursor-pointer"
            >
              See more
            </button>
          </div>
          <div className="bg-black/30 border border-white/5 divide-y divide-white/5">
            {rightList.map(renderListItem)}
          </div>
        </div>
      </div>

      {/* 2. Explore Catalog CTA Banner */}
      <div className="relative border border-white/15 bg-neutral-950 p-8 sm:p-12 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 select-none">
        {/* Dynamic auto-changing blurred backdrop */}
        {bgImages.length > 0 && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <img
              src={bgImages[currentBgIdx]}
              alt=""
              className="w-full h-full object-cover filter blur-[1px] explore-bg-animate transition-all duration-[1000ms]"
              key={currentBgIdx}
            />
            {/* Lighter overlays to keep cover art clearly visible */}
            <div className="absolute inset-0 bg-black/25 md:bg-gradient-to-r md:from-neutral-950/70 md:via-transparent md:to-neutral-950/70" />
          </div>
        )}

        {/* Banner Left Content */}
        <div className="relative z-10 space-y-3.5 max-w-xl text-center md:text-left">
          <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wider">
            {catalogueTitle || "Explore our catalogue"}
          </h2>
          <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-medium">
            {catalogueDesc || "There are thousands of horror games waiting for you to discover. Filter by developer, tags, scare intensity, platform, and pricing to pinpoint your next favorite nightmare."}
          </p>
        </div>

        {/* Banner Right Action Button */}
        <div className="relative z-10 shrink-0">
          <button
            onClick={onExplore}
            className="font-mono text-xs font-black uppercase tracking-widest bg-white text-black hover:bg-[#ff2a2a] hover:text-white border border-white hover:border-[#ff2a2a] px-6 py-4 transition-all duration-150 rounded-none cursor-pointer flex items-center gap-2 group/btn"
          >
            [ SEE ALL GAMES ]
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1.5 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* 3. Patron Support Section */}
      <div className="flex flex-col items-center justify-center text-center py-12 px-6 border-t border-white/5 space-y-6 max-w-4xl mx-auto mt-6">
        {/* Star Badge */}
        <div className="relative flex items-center justify-center w-12 h-12 bg-red-950/20 border border-red-500/30 rounded-full shadow-[0_0_15px_rgba(255,42,42,0.15)]">
          <Star className="w-5 h-5 text-red-500 fill-current" />
        </div>

        {/* Heading */}
        <h3 className="font-mono text-sm sm:text-base font-black uppercase tracking-widest text-white">
          {supportTitle || "Help keep the project alive"}
        </h3>

        {/* Wording */}
        <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed font-medium">
          {supportDesc || "hoGAMEGATA is a free, ad-free database. We never show ads, sell user data, or lock features behind paywalls. If you value horror game preservation or just like the purpose of this project, help us cover our database hosting and API operating costs. A small donation keeps the website up, bring new features, and help make the experience better."}
        </p>

       

        {/* Become Patron Action Button */}
        <a href="/support" className="inline-block pt-2">
          <button className="font-mono text-[12px] sm:text-xs font-black uppercase tracking-widest bg-black text-white hover:bg-[#ff2a2a] hover:text-white border border-red-500/40 hover:border-[#ff2a2a] px-5 py-3 transition-all duration-150 rounded-none cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(255,42,42,0.05)] hover:shadow-[0_0_15px_rgba(255,42,42,0.2)]">
             SUPPORT US! 
          </button>
        </a>
      </div>

      {/* Inject custom CSS keyframe for the slideshow fade transition */}
      <style>{`
        @keyframes exploreBgFade {
          0% { opacity: 0; }
          15% { opacity: 0.50; }
          85% { opacity: 0.50; }
          100% { opacity: 0; }
        }
        .explore-bg-animate {
          animation: exploreBgFade 10000ms infinite ease-in-out;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
