"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Heart, Star, Check } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export interface HeroGameData {
  id: string;
  title: string;
  slug: string;
  status: string;
  coverUrl: string | null;
  rating: number | null;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  releaseDate: string | null;
  screenshots: string[];
  trailerUrl?: string | null;
  purchaseLinks?: Array<{
    storeName: string;
    url: string;
  }>;
  priceSnapshots?: Array<{
    storeName: string;
    dealPrice: number;
    retailPrice: number;
    discountPercent: number;
    dealUrl: string;
    currency: string;
    country: string;
  }>;
}

interface HeroCarouselProps {
  games: HeroGameData[];
  activeRegion: string;
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

export default function HeroCarousel({ games, activeRegion }: HeroCarouselProps) {
  const { user } = useAuth();
  const { cartItems, addToCart, removeFromCart } = useCart();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [wishedMap, setWishedMap] = useState<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Return early if no games
  if (!games || games.length === 0) return null;

  const activeGame = games[activeIndex];

  // Load wishlists from localStorage
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

  // Sync auto-scroll timer (resets whenever activeIndex changes or paused state toggles)
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % games.length);
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeIndex, isPaused, games.length]);

  // Pause carousel when tab is inactive to prevent browser background congestion
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + games.length) % games.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % games.length);
  };

  // Find cheapest deal for active game
  const findCheapestDeal = (game: HeroGameData) => {
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

  const deal = findCheapestDeal(activeGame);
  const hasDiscount = deal && deal.discountPercent > 0;
  const ratingDisplay = activeGame.rating ? `${(activeGame.rating / 10).toFixed(1)}` : null;
  const badge = getCategoryBadge(activeGame.category, activeGame.title);

  // Landscape image: use first screenshot, fallback to cover, fallback to dark color
  const landscapeImage = activeGame.screenshots && activeGame.screenshots.length > 0
    ? activeGame.screenshots[0]
    : activeGame.coverUrl;

  const isWished = wishedMap[activeGame.id] || false;
  const isHeroInCart = cartItems.some(i => i.gameId === activeGame.id);

  const storeKey = deal ? deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const directLink = deal
    ? `/re/${activeGame.slug}/${storeKey}?gameId=${activeGame.id}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
    : `/game/${activeGame.slug}`;

  const prevIndex = (activeIndex - 1 + games.length) % games.length;
  const nextIndex = (activeIndex + 1) % games.length;

  const prevGame = games[prevIndex];
  const nextGame = games[nextIndex];

  const prevLandscape = prevGame.screenshots && prevGame.screenshots.length > 0
    ? prevGame.screenshots[0]
    : prevGame.coverUrl;

  const nextLandscape = nextGame.screenshots && nextGame.screenshots.length > 0
    ? nextGame.screenshots[0]
    : nextGame.coverUrl;

  return (
    <div
      className="relative w-[100vw] left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] overflow-hidden select-none group mb-8 py-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-stretch justify-center gap-4 w-full h-[320px] sm:h-[400px] md:h-[450px]">
        {/* Left slide (Previous preview, peeking from the left edge of viewport) */}
        {prevLandscape && (
          <button
            onClick={handlePrev}
            className="hidden lg:block flex-1 shrink-0 opacity-50 hover:opacity-85 transition-all duration-300 relative overflow-hidden cursor-pointer text-left focus:outline-none"
            aria-label="Previous slide preview"
          >
            <img
              src={prevLandscape}
              alt=""
              className="w-full h-full object-cover object-center filter blur-[2px] brightness-[0.65] transition-all duration-300 scale-100 hover:scale-102"
            />
            {/* Blending gradients and dark tints */}
            <div className="absolute inset-0 bg-black/30 hover:bg-black/10 transition-colors duration-300" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-black/35 to-transparent pointer-events-none" />
            
            <div className="absolute top-1/2 right-4 -translate-y-1/2 z-20 w-8 h-8 bg-black/60 border border-white/10 flex items-center justify-center text-white">
              <ChevronLeft className="w-4 h-4" />
            </div>
          </button>
        )}

        {/* Center active slide (Constrained to max-w-5xl, perfectly centered) */}
        <div className="w-full max-w-[92vw] lg:max-w-5xl shrink-0 bg-black relative overflow-hidden flex flex-col md:flex-row transition-all duration-300">
          {/* Background landscape artwork */}
          {landscapeImage ? (
            <div className="absolute inset-0 w-full h-full bg-neutral-900 transition-all duration-700 ease-out">
              <img
                src={landscapeImage}
                alt={activeGame.title}
                className="w-full h-full object-cover object-center scale-100 group-hover:scale-101 transition-transform duration-[7000ms] ease-out"
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
              <span className="font-mono text-xs uppercase tracking-widest text-white/30">No landscape mapping</span>
            </div>
          )}

          {/* Dark gradient overlay for readability (left-to-right, lighter on the right side) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/20 md:bg-gradient-to-r md:from-black md:via-black/40 md:to-transparent z-10" />

          {/* Content overlay */}
          <div className="absolute inset-0 z-20 flex flex-col justify-end md:justify-center p-6 sm:p-10 md:w-3/5 gap-4">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              {badge && (
                <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest bg-red-950 text-red-300 border border-red-300 font-black px-2 py-0.5 select-none leading-none">
                  {badge}
                </span>
              )}
              {activeGame.status && (
                <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest bg-black text-white/60 border border-white/20 font-bold px-2 py-0.5 select-none leading-none">
                  {activeGame.status}
                </span>
              )}
            </div>

            {/* Game Title */}
            <h2 className="text-white text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-wide leading-tight line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {cleanTitle(activeGame.title)}
            </h2>

            {/* Developer & Specs info */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 font-mono text-[10px] sm:text-xs text-white/70">
              <span className="font-bold">BY {activeGame.developerNames ? activeGame.developerNames.split(", ")[0].toUpperCase() : "UNKNOWN DEVELOPER"}</span>
              <span className="hidden sm:inline text-white/30">|</span>
              <div className="flex items-center gap-2">
                <PlatformLogos platformNames={activeGame.platformNames} solid={true} />
              </div>
              {ratingDisplay && (
                <>
                  <span className="hidden sm:inline text-white/30">|</span>
                  <span className="flex items-center gap-1 font-bold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-current" /> {ratingDisplay}
                  </span>
                </>
              )}
            </div>

            {/* Price & Buying Call-to-action */}
            <div className="flex items-center gap-4 mt-2">
              {/* Price Block */}
              {deal ? (
                <div className="flex items-center bg-black/50 border border-white/20 p-1 backdrop-blur-xs">
                  {hasDiscount && (
                    <span className="font-mono text-xs sm:text-sm font-black bg-[#7b3fc4] text-white px-2 py-1.5 tracking-wide mr-2.5">
                      -{deal.discountPercent}%
                    </span>
                  )}
                  <div className="flex flex-col justify-center pr-2">
                    <span className="font-mono text-sm sm:text-base font-black text-emerald-400 leading-none">
                      {formatPrice(deal.dealPrice, deal.currency)}
                    </span>
                    {hasDiscount && (
                      <span className="font-mono text-[9px] sm:text-[10px] text-white/40 line-through mt-0.5 leading-none">
                        {formatPrice(deal.retailPrice, deal.currency)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="font-mono text-xs text-white/40 uppercase tracking-widest border border-white/10 px-3 py-2 bg-black/30 backdrop-blur-xs">
                  [ NO PRICE MAPPING ]
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={directLink}
                  target={deal ? "_blank" : undefined}
                  rel={deal ? "noopener noreferrer" : undefined}
                  className="font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white text-black hover:bg-[#ff2a2a] hover:text-white border border-white hover:border-[#ff2a2a] px-4 py-2.5 sm:px-6 sm:py-3 transition-colors duration-150 rounded-none cursor-pointer leading-none"
                >
                  {deal ? "[ GET IT NOW ]" : "[ VIEW DETAILS ]"}
                </a>

                {/* Cart Toggle button */}
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isHeroInCart) {
                      await removeFromCart(activeGame.id);
                    } else {
                      // Reconstruct partial game object for context logic
                      const gameMock = {
                        id: activeGame.id,
                        title: activeGame.title,
                        slug: activeGame.slug,
                        coverUrl: activeGame.coverUrl,
                        priceSnapshots: activeGame.priceSnapshots || (deal ? [deal] : []),
                      };
                      await addToCart(gameMock);
                      window.dispatchEvent(new Event("gamegata_open_cart"));
                    }
                  }}
                  title={isHeroInCart ? "Remove from cart" : "Add to cart"}
                  className={`w-10 h-10 border flex items-center justify-center transition-colors duration-150 cursor-pointer rounded-none
                    ${isHeroInCart
                      ? "bg-[#7b3fc4] border-[#7b3fc4] text-white"
                      : "bg-black/50 border-white/30 text-white/50 hover:bg-white hover:border-white hover:text-black"
                    }`}
                >
                  {isHeroInCart ? (
                    <Check className="w-4.5 h-4.5 stroke-[2.5]" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                  )}
                </button>

                <button
                  onClick={(e) => toggleWish(e, activeGame.id)}
                  title={isWished ? "Remove from wishlist" : "Add to wishlist"}
                  className={`w-10 h-10 border flex items-center justify-center transition-colors duration-150 cursor-pointer rounded-none
                    ${isWished
                      ? "bg-red-950 border-red-500 text-red-500 hover:bg-black hover:border-white/40 hover:text-white/40"
                      : "bg-black/50 border-white/30 text-white/50 hover:bg-white hover:border-white hover:text-black"
                    }`}
                  aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className="w-4.5 h-4.5" fill={isWished ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>

          {/* Prev / Next Chevrons Overlay (only on mobile, hidden on desktop since we have side peeks) */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-14 bg-black/60 hover:bg-white hover:text-black text-white border border-white/20 hover:border-white flex items-center justify-center lg:hidden cursor-pointer focus:outline-none"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-14 bg-black/60 hover:bg-white hover:text-black text-white border border-white/20 hover:border-white flex items-center justify-center lg:hidden cursor-pointer focus:outline-none"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Progress Bars Indicator Row (Visual cues at bottom of center slide) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-xs border border-white/5">
            {games.map((_, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className="group/dot w-8 h-1 flex items-center justify-center relative cursor-pointer focus:outline-none"
                  aria-label={`Go to slide ${index + 1}`}
                >
                  {/* Background line segment */}
                  <span className={`absolute inset-0 h-0.75 w-full bg-white/20 group-hover/dot:bg-white/40 transition-colors ${isActive ? "bg-white/30" : ""}`} />
                  {/* Inner progress bar */}
                  {isActive && (
                    <span
                      style={{
                        animationPlayState: isPaused ? "paused" : "running"
                      }}
                      className="absolute left-0 top-0.125 h-0.75 bg-red-500 rounded-none w-0 animate-[carouselProgress_7000ms_linear_forwards]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right slide (Next preview, peeking from the right edge of viewport) */}
        {nextLandscape && (
          <button
            onClick={handleNext}
            className="hidden lg:block flex-1 shrink-0 opacity-50 hover:opacity-85 transition-all duration-300 relative overflow-hidden cursor-pointer text-left focus:outline-none"
            aria-label="Next slide preview"
          >
            <img
              src={nextLandscape}
              alt=""
              className="w-full h-full object-cover object-center filter blur-[2px] brightness-[0.65] transition-all duration-300 scale-100 hover:scale-102"
            />
            {/* Blending gradients and dark tints */}
            <div className="absolute inset-0 bg-black/30 hover:bg-black/10 transition-colors duration-300" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#080808] via-black/35 to-transparent pointer-events-none" />
            
            <div className="absolute top-1/2 left-4 -translate-y-1/2 z-20 w-8 h-8 bg-black/60 border border-white/10 flex items-center justify-center text-white">
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        )}
      </div>

      {/* Inject custom CSS keyframe for the progress line animation */}
      <style>{`
        @keyframes carouselProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
