"use client";

import { useState, useEffect } from "react";
import { Star, Heart, Calendar, Check, ArrowRight } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle, stripHtml } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";
import type { HeroGameData } from "./HeroCarousel";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import HoverTrailer from "./HoverTrailer";

interface TabCatalogProps {
  latest: HeroGameData[];
  trending: HeroGameData[];
  upcoming: HeroGameData[];
  topRated: HeroGameData[];
  itchGames?: HeroGameData[];
  activeRegion: string;
  onBrowseAll?: (tab: "latest" | "trending" | "top-rated" | "upcoming" | "for-you") => void;
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

const formatDate = (dateVal: string | number | Date | null | undefined) => {
  if (!dateVal) return "TBD";
  try {
    let d: Date;
    if (typeof dateVal === "number" || (/^\d+$/.test(String(dateVal)) && !String(dateVal).includes("-"))) {
      const num = Number(dateVal);
      d = new Date(num > 100000000000 ? num : num * 1000);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970 || d.getFullYear() > 2100) return "TBD";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short"
    });
  } catch {
    return "TBD";
  }
};

const getLandscapeImage = (game: HeroGameData) => {
  if (game.screenshots && game.screenshots.length > 0) {
    return game.screenshots[0];
  }
  return game.coverUrl || "";
};

const getFeaturedDeal = (game: HeroGameData, region: string) => {
  if (!game.priceSnapshots || game.priceSnapshots.length === 0) return null;
  let regional = game.priceSnapshots.filter(p => p.country === region);
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

interface SectionHeaderProps {
  badge: string;
  title: string;
  subtitle: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  id?: string;
}

function SectionHeader({
  badge,
  title,
  subtitle,
  actionText,
  onAction,
  actionHref,
  id,
}: SectionHeaderProps) {
  return (
    <div id={id} className="scroll-mt-24 pt-4 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-white/50 font-sans leading-relaxed">
            {subtitle}
          </p>
        </div>

        {(actionText && (onAction || actionHref)) && (
          actionHref ? (
            <a
              href={actionHref}
              className="self-start sm:self-auto font-sans text-xs font-semibold tracking-wide text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/10 px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-white/10 hover:border-white/25 shrink-0"
            >
              <span>{actionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={onAction}
              className="self-start sm:self-auto font-sans text-xs font-semibold tracking-wide text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/10 px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-white/10 hover:border-white/25 shrink-0"
            >
              <span>{actionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface StoreCardProps {
  game: HeroGameData;
  activeRegion: string;
  isWished: boolean;
  isInCart: boolean;
  onToggleWish: (e: React.MouseEvent, gameId: string) => void;
  onToggleCart: (e: React.MouseEvent, game: HeroGameData, deal: any) => void;
  showScore?: boolean;
  showDate?: boolean;
  isItch?: boolean;
}

function StoreCard({
  game,
  activeRegion,
  isWished,
  isInCart,
  onToggleWish,
  onToggleCart,
  showScore,
  showDate,
  isItch,
}: StoreCardProps) {
  const deal = getFeaturedDeal(game, activeRegion);
  const badge = getCategoryBadge(game.category, game.title);
  const hasDiscount = deal && deal.discountPercent > 0;
  const isVN = badge === "Visual Novel";
  const badgeBg = isVN ? "bg-purple-950/80 text-purple-200 border-purple-400/30" : "bg-red-950/80 text-red-200 border-red-400/30";

  return (
    <a
      href={`/game/${game.slug}`}
      className="bg-[#121217]/90 hover:bg-[#181820] rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 group border border-white/[0.04] hover:border-white/15 h-full relative shadow-md hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
    >
      <div className="space-y-3">
        {/* Landscape Image with HoverTrailer */}
        <div className="relative aspect-video w-full bg-neutral-900 rounded-xl overflow-hidden shrink-0">
          <HoverTrailer
            trailerUrl={game.trailerUrl}
            coverUrl={getLandscapeImage(game)}
            altText={game.title}
            aspectClass="w-full h-full"
          />

          {/* Top Left Badge */}
          {isItch ? (
            <span className="absolute top-2 left-2 font-mono text-[8px] sm:text-[9px] uppercase tracking-widest bg-[#fa5c5c] text-black border border-[#fa5c5c] font-black px-1.5 py-0.5 z-10 rounded select-none shadow">
              itch.io
            </span>
          ) : badge ? (
            <span className={`absolute top-2 left-2 font-sans text-[9px] font-medium px-1.5 py-0.5 z-10 rounded-md backdrop-blur-md border ${badgeBg}`}>
              {badge}
            </span>
          ) : null}

          {/* Bottom Left Score or Date */}
          {showScore && game.rating ? (
            <span className="absolute bottom-2 left-2 font-sans text-[9px] font-semibold bg-black/80 text-amber-400 backdrop-blur-md border border-white/15 px-1.5 py-0.5 z-10 flex items-center gap-0.5 rounded-md">
              <Star className="w-2.5 h-2.5 fill-current" /> {(game.rating / 10).toFixed(1)}
            </span>
          ) : showDate && game.releaseDate ? (
            <span className="absolute bottom-2 left-2 font-sans text-[9px] font-semibold bg-black/80 text-white/90 backdrop-blur-md border border-white/15 px-1.5 py-0.5 z-10 flex items-center gap-1 rounded-md">
              <Calendar className="w-2.5 h-2.5 text-white/60" /> {formatDate(game.releaseDate)}
            </span>
          ) : null}

          {/* Top Right Quick Actions */}
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-90 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => onToggleCart(e, game, deal)}
              title={isInCart ? "Remove from cart" : "Add to cart"}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                isInCart
                  ? "bg-purple-600 text-white opacity-100"
                  : "bg-black/70 text-white/80 hover:bg-white hover:text-black border border-white/10"
              }`}
            >
              {isInCart ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
              )}
            </button>

            <button
              onClick={(e) => onToggleWish(e, game.id)}
              title={isWished ? "Remove from wishlist" : "Add to wishlist"}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none ${
                isWished
                  ? "bg-red-950/90 text-red-400 border border-red-500/40"
                  : "bg-black/70 text-white/80 hover:bg-white hover:text-black border border-white/10"
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={isWished ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Title and Developer */}
        <div className="space-y-1">
          <h4 className="font-sans text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-white/90 transition-colors">
            {cleanTitle(game.title)}
          </h4>
          <span className="font-sans text-xs text-white/45 block font-normal truncate">
            by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
          </span>
        </div>
      </div>

      {/* Footer Info & Pricing */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.04] font-sans text-xs shrink-0">
        <PlatformLogos platformNames={game.platformNames} />
        
        <div className="flex items-center gap-1.5 font-semibold">
          {deal ? (
            <>
              {hasDiscount && (
                <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded-md font-sans">
                  -{deal.discountPercent}%
                </span>
              )}
              <span className="text-emerald-400 text-xs sm:text-sm font-sans font-bold">
                {formatPrice(deal.dealPrice, deal.currency)}
              </span>
            </>
          ) : isItch ? (
            <span className="text-white/50 text-[11px] font-mono uppercase tracking-wider font-semibold">
              itch.io
            </span>
          ) : (
            <span className="text-white/30 text-xs font-normal">—</span>
          )}
        </div>
      </div>
    </a>
  );
}

export default function TabCatalog({
  latest,
  trending,
  upcoming,
  topRated,
  itchGames = [],
  activeRegion,
  onBrowseAll
}: TabCatalogProps) {
  const { user } = useAuth();
  const { cartItems, addToCart, removeFromCart } = useCart();
  const [wishedMap, setWishedMap] = useState<Record<string, boolean>>({});

  // Load wishlist state from localStorage
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

  const toggleWish = async (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      const saved: string[] = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      const isWished = wishedMap[gameId];
      const next = isWished ? saved.filter(id => id !== gameId) : [...saved, gameId];
      localStorage.setItem("gamegata_wishlist", JSON.stringify(next));
      setWishedMap(prev => ({ ...prev, [gameId]: !isWished }));

      const method = isWished ? "DELETE" : "POST";
      fetch("/api/user/wishlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      }).catch(err => console.error("Cloud wishlist sync toggle failed:", err));
    } catch { /* ignore */ }
  };

  const handleToggleCart = async (e: React.MouseEvent, game: HeroGameData, deal: any) => {
    e.preventDefault();
    e.stopPropagation();
    const isInCart = cartItems.some(i => i.gameId === game.id);
    if (isInCart) {
      await removeFromCart(game.id);
    } else {
      const gameMock = {
        id: game.id,
        title: game.title,
        slug: game.slug,
        coverUrl: game.coverUrl,
        priceSnapshots: game.priceSnapshots || (deal ? [deal] : []),
      };
      await addToCart(gameMock);
      window.dispatchEvent(new Event("gamegata_open_cart"));
    }
  };

  const scrollToSection = (id: string) => {
    if (typeof document !== "undefined") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Safe fallback lists
  const trendingGames = trending && trending.length > 0 ? trending : latest;
  const featuredTrendingGame = trendingGames[0] || null;
  const companionTrendingGames = trendingGames.slice(1, 7);

  const newReleaseGames = latest && latest.length > 0 ? latest.slice(0, 8) : [];
  
  // Underground Itch section: trending itch games first, then dedicated itchGames prop, then latest itch
  const trendingItch = trending?.filter((g: any) => g.slug?.startsWith("itch-")) || [];
  const safeItchGames = trendingItch.length > 0
    ? trendingItch.slice(0, 8)
    : (itchGames && itchGames.length > 0)
      ? itchGames.slice(0, 8)
      : latest.filter((g: any) => g.slug?.startsWith("itch-")).slice(0, 8);

  const topRatedList = topRated && topRated.length > 0 ? topRated.slice(0, 8) : [];
  const upcomingList = upcoming && upcoming.length > 0 ? upcoming.slice(0, 8) : [];

  return (
    <div className="space-y-14 sm:space-y-16">

      {/* ── Section 1: Trending Now (Spotlight + Companion Grid) ── */}
      <section className="space-y-6">
        <SectionHeader
          id="trending-now"
          badge="FEATURED SPOTLIGHT"
          title="Trending Now"
          actionText="Browse All Trending"
          onAction={() => onBrowseAll && onBrowseAll("trending")}
        />

        <div className="relative bg-[#0b0b0e] rounded-3xl p-6 sm:p-8 lg:p-10 overflow-hidden shadow-2xl border border-white/[0.06]">
          {featuredTrendingGame && getLandscapeImage(featuredTrendingGame) && (
            <div className="absolute inset-0 z-0 select-none pointer-events-none opacity-[0.12] mix-blend-screen">
              <img
                src={getLandscapeImage(featuredTrendingGame)}
                alt=""
                className="w-full h-full object-cover filter blur-md"
              />
              <div className="absolute inset-0 bg-[#0b0b0e]/80" />
            </div>
          )}

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {/* Featured Spotlight Card */}
            {featuredTrendingGame && (() => {
              const game = featuredTrendingGame;
              const deal = getFeaturedDeal(game, activeRegion);
              const badge = getCategoryBadge(game.category, game.title);
              const summaryText = stripHtml(game.summary || "");
              const isVN = badge === "Visual Novel";
              const badgeBg = isVN ? "bg-purple-950/80 text-purple-200 border-purple-400/30" : "bg-red-950/80 text-red-200 border-red-400/30";
              const isWished = wishedMap[game.id] || false;
              const isSpotlightInCart = cartItems.some(i => i.gameId === game.id);
              const storeKey = deal ? deal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
              const directLink = deal
                ? `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(deal.dealUrl)}`
                : `/game/${game.slug}`;

              return (
                <div className="bg-[#121217]/90 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 relative h-full border border-white/[0.06] hover:border-white/15 transition-all duration-300 shadow-xl">
                  <div className="space-y-5">
                    {/* Landscape Artwork with HoverTrailer */}
                    <a href={`/game/${game.slug}`} className="block relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 group/img">
                      <HoverTrailer
                        trailerUrl={game.trailerUrl}
                        coverUrl={getLandscapeImage(game)}
                        altText={game.title}
                        aspectClass="w-full h-full"
                      />
                      {badge && (
                        <span className={`absolute top-3 left-3 font-sans text-[10px] tracking-wide font-medium px-2 py-0.5 z-10 rounded-md backdrop-blur-md border ${badgeBg}`}>
                          {badge}
                        </span>
                      )}
                      {game.rating && (
                        <span className="absolute bottom-3 left-3 font-sans text-[10px] font-semibold bg-black/80 text-amber-400 backdrop-blur-md border border-white/15 px-2 py-0.5 z-10 flex items-center gap-1 rounded-md">
                          <Star className="w-3 h-3 fill-current" /> {(game.rating / 10).toFixed(1)}
                        </span>
                      )}
                    </a>

                    <div className="space-y-2.5">
                      <a href={`/game/${game.slug}`} className="block group/title">
                        <h3 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight line-clamp-2 leading-snug group-hover/title:text-white/90 transition-colors">
                          {cleanTitle(game.title)}
                        </h3>
                      </a>

                      <span className="font-sans text-xs text-white/50 block font-medium">
                        by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
                      </span>

                      {summaryText && (
                        <p className="text-xs sm:text-sm text-white/65 font-sans leading-relaxed line-clamp-4 pt-1">
                          {summaryText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="pt-4 flex items-center justify-between mt-auto border-t border-white/[0.06]">
                    {deal ? (
                      <div className="flex flex-col justify-center">
                        <span className="font-sans text-base sm:text-lg font-bold text-emerald-400">
                          {formatPrice(deal.dealPrice, deal.currency)}
                        </span>
                        {deal.discountPercent > 0 && (
                          <span className="font-sans text-xs text-white/40 line-through leading-none mt-0.5">
                            {formatPrice(deal.retailPrice, deal.currency)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-sans text-xs text-white/40 font-medium">—</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isSpotlightInCart) {
                            await removeFromCart(game.id);
                          } else {
                            await addToCart(game);
                            window.dispatchEvent(new Event("gamegata_open_cart"));
                          }
                        }}
                        className={`w-9 h-9 flex items-center justify-center transition-all duration-200 cursor-pointer rounded-xl ${
                          isSpotlightInCart
                            ? "bg-purple-600 text-white"
                            : "bg-white/5 text-white/70 hover:bg-white hover:text-black"
                        }`}
                        title={isSpotlightInCart ? "Remove from cart" : "Add to cart"}
                      >
                        {isSpotlightInCart ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                          </svg>
                        )}
                      </button>

                      <button
                        onClick={(e) => toggleWish(e, game.id)}
                        className={`w-9 h-9 flex items-center justify-center transition-all duration-200 cursor-pointer rounded-xl ${
                          isWished
                            ? "bg-red-950/80 text-red-400 border border-red-500/30"
                            : "bg-white/5 text-white/70 hover:bg-white hover:text-black"
                        }`}
                        title={isWished ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        <Heart className="w-4 h-4" fill={isWished ? "currentColor" : "none"} />
                      </button>

                      <a
                        href={directLink}
                        target={deal ? "_blank" : undefined}
                        rel={deal ? "noopener noreferrer" : undefined}
                        className="font-sans text-xs font-semibold bg-white text-black hover:bg-white/90 px-4 py-2.5 transition-all duration-200 rounded-xl leading-none block text-center cursor-pointer shadow-md"
                      >
                        {deal ? "Buy Now" : "View Details"}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Companion Trending Grid (6 Cards) */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4.5">
              {companionTrendingGames.map((game) => (
                <StoreCard
                  key={game.id}
                  game={game}
                  activeRegion={activeRegion}
                  isWished={!!wishedMap[game.id]}
                  isInCart={cartItems.some(i => i.gameId === game.id)}
                  onToggleWish={toggleWish}
                  onToggleCart={handleToggleCart}
                  showScore={true}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: New Releases (Fresh From The Crypt) ── */}
      {newReleaseGames.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            id="new-releases"
            badge="FRESH DROPS"
            title="New Releases"
            actionText="Browse All New Releases"
            onAction={() => onBrowseAll && onBrowseAll("latest")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
            {newReleaseGames.map((game) => (
              <StoreCard
                key={game.id}
                game={game}
                activeRegion={activeRegion}
                isWished={!!wishedMap[game.id]}
                isInCart={cartItems.some(i => i.gameId === game.id)}
                onToggleWish={toggleWish}
                onToggleCart={handleToggleCart}
                showDate={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Underground Itch.io Horrors (Indie Showcase) ── */}
      {safeItchGames.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            id="itch-horrors"
            badge="ITCH.IO EXCLUSIVES"
            title="Underground Itch.io Horrors"
            actionText="Explore Indie Catalog"
            actionHref="/games?tags=indie"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
            {safeItchGames.map((game) => (
              <StoreCard
                key={game.id}
                game={game}
                activeRegion={activeRegion}
                isWished={!!wishedMap[game.id]}
                isInCart={cartItems.some(i => i.gameId === game.id)}
                onToggleWish={toggleWish}
                onToggleCart={handleToggleCart}
                isItch={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Section 4: Top Rated Horrors (Hall of Fame) ── */}
      {topRatedList.length > 0 && (
        <section className="space-y-6">
          <SectionHeader
            id="top-rated"
            badge="HALL OF FAME"
            title="Top Rated Horrors"
            actionText="Browse All Top Rated"
            onAction={() => onBrowseAll && onBrowseAll("top-rated")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
            {topRatedList.map((game) => (
              <StoreCard
                key={game.id}
                game={game}
                activeRegion={activeRegion}
                isWished={!!wishedMap[game.id]}
                isInCart={cartItems.some(i => i.gameId === game.id)}
                onToggleWish={toggleWish}
                onToggleCart={handleToggleCart}
                showScore={true}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
