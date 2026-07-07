"use client";

import { useState, useEffect } from "react";
import { Search, Calendar, Sparkles, Check, Heart, Trash2 } from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";
import NyanLoader from "./NyanLoader";
import { usePreferences } from "../hooks/usePreferences";
import HeroCarousel from "./HeroCarousel";
import TabCatalog from "./TabCatalog";
import StorefrontLists from "./StorefrontLists";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CartProvider, useCart } from "../context/CartContext";
import HoverTrailer from "./HoverTrailer";

export interface GameData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  coverUrl: string | null;
  isTrending: boolean;
  rating: number | null;
  category: number | null;
  esrbRating: string | null;
  pegiRating: string | null;
  developerNames: string | null;
  genreNames: string | null;
  platformNames: string | null;
  rawgEnriched?: boolean;
  releaseDate?: string | Date | null;
  trailerUrl?: string | null;
  tags: Array<{ name: string; slug: string }>;
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

const getShortEsrbRating = (rating: string | null): string | null => {
  if (!rating) return null;
  const lower = rating.toLowerCase();
  if (lower.includes("everyone 10")) return "E10+";
  if (lower.includes("everyone")) return "E";
  if (lower.includes("teen")) return "T";
  if (lower.includes("mature")) return "M";
  if (lower.includes("adult")) return "AO";
  if (lower.includes("pending")) return "RP";
  return rating.substring(0, 3).toUpperCase();
};

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

const formatDate = (dateVal: string | Date | null | undefined) => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short"
    });
  } catch {
    return "";
  }
};

const getDirectLink = (game: GameData) => {
  const itchLink = game.purchaseLinks?.find(l => l.storeName.toLowerCase() === "itch.io" || l.storeName.toLowerCase() === "itch");
  if (itchLink?.url) return itchLink.url;
  const gogLink = game.purchaseLinks?.find(l => l.storeName.toLowerCase().includes("gog"));
  if (gogLink?.url) return gogLink.url;
  const steamLink = game.purchaseLinks?.find(l => l.storeName.toLowerCase() === "steam");
  if (steamLink?.url) return steamLink.url;
  if (game.purchaseLinks && game.purchaseLinks.length > 0) return game.purchaseLinks[0].url;
  return null;
};

interface GameCardProps {
  game: GameData;
  index: number;
  activeRegion: string;
  findCheapestDeal: (game: GameData) => any;
  mobileLayout?: "grid" | "list";
  onClick?: (e: React.MouseEvent) => void;
}

// ─── GOG-style List Row ───────────────────────────────────────────────────────
function ListRow({ game, index, findCheapestDeal, onClick }: Omit<GameCardProps, "activeRegion" | "mobileLayout">) {
  const [hoverCart, setHoverCart] = useState(false);
  const [wished, setWished] = useState(false);
  const [wishAnim, setWishAnim] = useState(false);
  const finalDeal = findCheapestDeal(game);
  const hasItchBadge = game.slug.startsWith("itch-");
  const hasGogBadge = game.purchaseLinks?.some(l => l.storeName.toLowerCase().includes("gog")) || game.slug.startsWith("gog-");

  const { user } = useAuth();
  const { addToCart, removeFromCart, cartItems } = useCart();
  const isInCart = cartItems.some(item => item.gameId === game.id);

  // Load wishlist state from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      setWished(Array.isArray(saved) && saved.includes(game.id));
    } catch { /* ignore */ }
  }, [game.id]);

  const toggleWish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const saved: string[] = JSON.parse(localStorage.getItem("gamegata_wishlist") || "[]");
      const next = wished ? saved.filter(id => id !== game.id) : [...saved, game.id];
      localStorage.setItem("gamegata_wishlist", JSON.stringify(next));

      if (user) {
        const method = wished ? "DELETE" : "POST";
        fetch("/api/user/wishlist", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: game.id }),
        }).catch(err => console.error("Cloud wishlist sync toggle failed:", err));
      }
    } catch { /* ignore */ }
    setWished(p => !p);
    setWishAnim(true);
    setTimeout(() => setWishAnim(false), 400);
  };

  const badge = getCategoryBadge(game.category, game.title);
  const isVN = badge === "Visual Novel";
  const badgeBg = isVN ? "bg-[#581c87] text-[#f5d0fe] border-[#f5d0fe]" : "bg-[#7f1d1d] text-[#fca5a5] border-[#fca5a5]";

  const itchLink = game.purchaseLinks?.find(
    l => l.storeName.toLowerCase() === "itch.io" || l.storeName.toLowerCase() === "itch"
  )?.url;

  const storeKey = finalDeal ? finalDeal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const dealUrl = finalDeal
    ? `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(finalDeal.dealUrl)}`
    : itchLink
    ? `/re/${game.slug}/itchio?gameId=${game.id}&fallbackUrl=${encodeURIComponent(itchLink)}`
    : "";
  const hasDiscount = finalDeal && finalDeal.discountPercent > 0;

  const handleCartClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      await removeFromCart(game.id);
    } else {
      await addToCart(game);
      window.dispatchEvent(new Event("gamegata_open_cart"));
    }
  };

  const directLink = game.rawgEnriched === false ? getDirectLink(game) : null;

  return (
    <a
      href={directLink || `/game/${game.slug}`}
      target={directLink ? "_blank" : undefined}
      rel={directLink ? "noopener noreferrer" : undefined}
      onClick={(e) => {
        if (directLink) {
          e.stopPropagation();
        } else if (onClick) {
          onClick(e);
        }
      }}
      data-tour={index === 0 ? "game-card" : undefined}
      className="group flex flex-row items-stretch border border-white/20 hover:border-white bg-black hover:bg-[#0d0d0d] transition-all duration-200 rounded-none overflow-hidden relative select-none min-h-[115px] sm:min-h-[140px]"
    >
      {/* ── Cover thumbnail ── */}
      <div className="relative shrink-0 w-[115px] sm:w-[140px] h-full overflow-hidden bg-neutral-900">
        {game.coverUrl ? (
          <img
            src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""}
            alt={game.title}
            className="object-cover object-top w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
            loading={index < 6 ? undefined : "lazy"}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">No Cover</span>
          </div>
        )}

        {/* Category badge on cover */}
        {badge && (
          <span className={`absolute top-2 left-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-widest border font-black px-1.5 py-0.5 z-10 ${badgeBg}`}>
            {badge}
          </span>
        )}
      </div>

      {/* ── Centre info (Title + Price Details) ── */}
      <div className="flex-grow flex flex-col justify-center px-4 sm:px-6 py-4 min-w-0 gap-2 sm:gap-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 className="text-white group-hover:text-white text-base sm:text-2xl font-extrabold tracking-wide uppercase line-clamp-1 leading-tight flex items-center gap-2">
            <span>{cleanTitle(game.title)}</span>
            {hasItchBadge && (
              <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest bg-[#fa5c5c] text-black border border-[#fa5c5c] font-black px-1.5 py-0.5 select-none shrink-0 leading-none">
                itch.io
              </span>
            )}
            {hasGogBadge && (
              <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest bg-[#7b3fc4] text-white border border-[#7b3fc4] font-black px-1.5 py-0.5 select-none shrink-0 leading-none">
                DRM-Free
              </span>
            )}
          </h4>

          {/* Price displayed next to the game title */}
          {finalDeal ? (
            <div className="flex items-center gap-2 shrink-0 select-none">
              {hasDiscount && (
                <span className="font-sans text-[10px] sm:text-[11px] font-black bg-[#7b3fc4] text-white px-2 py-0.5 rounded">
                  -{finalDeal.discountPercent}%
                </span>
              )}
              <span className="text-white font-extrabold text-sm sm:text-xl">
                {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
              </span>
              {hasDiscount && finalDeal.retailPrice > finalDeal.dealPrice && (
                <span className="text-[10px] sm:text-xs text-white/35 line-through">
                  {formatPrice(finalDeal.retailPrice, finalDeal.currency)}
                </span>
              )}
            </div>
          ) : itchLink ? (
            <div className="flex items-center gap-2 shrink-0 select-none">
              <span className="text-[#fa5c5c] font-extrabold text-[10px] sm:text-xs tracking-wider border border-[#fa5c5c]/40 px-2 py-0.5 rounded bg-[#fa5c5c]/5">ITCH.IO</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0 select-none">
              <span className="text-white/25 font-extrabold text-xs sm:text-base">—</span>
            </div>
          )}
        </div>

        <span className="font-mono text-xs sm:text-[14px] text-white/50 block font-bold leading-normal">
          by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
        </span>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <PlatformLogos platformNames={game.platformNames} solid={true} />
          <span className="font-mono text-[11px] sm:text-xs text-white/35 border border-white/15 px-2 py-0.5 uppercase font-bold tracking-wider leading-normal">
            {game.status === "released" && game.releaseDate ? `Released ${formatDate(game.releaseDate)}` : game.status}
          </span>
          {game.tags && game.tags.length > 0 && (
            <span className="hidden sm:inline font-mono text-[11px] sm:text-xs text-white/35 uppercase tracking-wide leading-normal">
              {game.tags[0].name}
            </span>
          )}
        </div>
      </div>

      {/* ── Right side block (Wishlist + Cart Buttons together) ── */}
      <div className="shrink-0 flex items-center justify-end pr-4 sm:pr-6 pl-2 gap-2 min-w-[120px] sm:min-w-[170px]">
        {/* Like / Wishlist Button */}
        <button
          onClick={toggleWish}
          title={wished ? "Remove from wishlist" : "Add to wishlist"}
          className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border rounded-xl transition-all duration-150 cursor-pointer select-none shrink-0
            ${wished
              ? "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
              : "bg-neutral-900 border-white/10 text-white/50 hover:bg-white hover:text-black hover:border-white"
            }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Cart Button */}
        <button
          onClick={handleCartClick}
          className={`h-9 sm:h-10 px-3 sm:px-4.5 flex items-center justify-center gap-1.5 border font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all duration-150 cursor-pointer select-none shrink-0
            ${isInCart
              ? "bg-[#7b3fc4]/10 border-[#7b3fc4]/50 text-[#7b3fc4] hover:bg-[#7b3fc4] hover:text-white"
              : "bg-white text-black border-white hover:bg-neutral-200"
            }`}
          title={isInCart ? "Remove from cart" : "Add to cart"}
        >
          {isInCart ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Cart</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span>Cart</span>
            </>
          )}
        </button>
      </div>
    </a>
  );
}

function GameCard({ game, index, activeRegion, findCheapestDeal, mobileLayout = "grid", onClick }: GameCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvedDeal, setResolvedDeal] = useState<any>(null);

  const { addToCart, removeFromCart, cartItems } = useCart();
  const isInCart = cartItems.some(item => item.gameId === game.id);

  const handleCartToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      await removeFromCart(game.id);
    } else {
      await addToCart(game);
      window.dispatchEvent(new Event("gamegata_open_cart"));
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPrompt(true);
  };

  const handleMouseLeave = () => {
    setShowPrompt(false);
  };

  const triggerPriceFetch = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPrompt(false);

    // 1. First check if we already have it in the initial cached snapshots
    const preExistingDeal = findCheapestDeal(game);
    if (preExistingDeal) {
      setResolvedDeal(preExistingDeal);
      return;
    }

    // 2. Fetch dynamically if not cached in snapshots
    setLoading(true);
    try {
      const response = await fetch(`/api/games/${game.id}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: game.title,
          purchaseLinks: [], // Let backend resolve
          country: activeRegion
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.deals && data.deals.length > 0) {
          setResolvedDeal(data.deals[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch price on demand:", err);
    } finally {
      setLoading(false);
    }
  };

  const finalDeal = resolvedDeal || findCheapestDeal(game);
  const hasItchBadge = game.slug.startsWith("itch-");
  const hasGogBadge = game.purchaseLinks?.some(l => l.storeName.toLowerCase().includes("gog")) || game.slug.startsWith("gog-");

  // In list mode, delegate to the GOG-style ListRow
  if (mobileLayout === "list") {
    return (
      <ListRow
        game={game}
        index={index}
        findCheapestDeal={findCheapestDeal}
        onClick={onClick}
      />
    );
  }

  const directLink = game.rawgEnriched === false ? getDirectLink(game) : null;

  return (
    <a 
      href={directLink || `/game/${game.slug}`}
      target={directLink ? "_blank" : undefined}
      rel={directLink ? "noopener noreferrer" : undefined}
      onContextMenu={handleContextMenu}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        if (directLink) {
          e.stopPropagation();
        } else if (onClick) {
          onClick(e);
        }
      }}
      data-tour={index === 0 ? "game-card" : undefined}
      className="border border-white bg-transparent rounded-none overflow-hidden hover:bg-white hover:text-black group transition-all duration-150 flex flex-col h-full relative select-none"
    >
      {/* Cover Image */}
      <div className={`relative bg-neutral-900 overflow-hidden shrink-0 flex items-center justify-center w-full border-b border-white ${game.slug.startsWith("itch-") ? "aspect-[5/4]" : "aspect-[3/4]"}`}>
        <HoverTrailer
          trailerUrl={game.trailerUrl}
          coverUrl={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending)}
          altText={game.title}
          aspectClass="w-full h-full"
        />

        {/* Floating Add to Cart Button */}
        <button
          onClick={handleCartToggle}
          title={isInCart ? "Remove from cart" : "Add to cart"}
          className={`absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center border transition-all duration-150 cursor-pointer select-none
            ${isInCart
              ? "bg-[#7b3fc4] border-[#7b3fc4] text-white shadow-[0_0_8px_rgba(123,63,196,0.9)]"
              : "bg-black/60 border-white/20 text-white/70 hover:bg-white hover:text-black hover:border-white hover:scale-110"
            }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </button>

        {/* Category Tag */}
        {(() => {
          const badge = getCategoryBadge(game.category, game.title);
          if (!badge) return null;
          const isVN = badge === "Visual Novel";
          const bgClass = isVN ? "bg-[#581c87] text-[#f5d0fe] border-[#f5d0fe]" : "bg-[#7f1d1d] text-[#fca5a5] border-[#fca5a5]";
          return (
            <span className={`absolute top-2 left-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-widest border font-black px-1.5 py-0.5 z-10 ${bgClass}`}>
              {badge}
            </span>
          );
        })()}
        {/* Primary Mood Tag */}
        {game.tags && game.tags.length > 0 && (
          <span className="absolute bottom-2 left-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-widest bg-white text-black font-black px-1.5 py-0.5">
            {game.tags[0].name}
          </span>
        )}
        {/* Age Rating Badge */}
        {(game.esrbRating || game.pegiRating) && (
          <span className="absolute bottom-2 right-2 font-mono text-[9px] sm:text-[10px] uppercase bg-black text-white border border-white font-black px-1.5 py-0.5 z-10 select-none group-hover:bg-white group-hover:text-black group-hover:border-black transition-all duration-150">
            {game.esrbRating ? getShortEsrbRating(game.esrbRating) : game.pegiRating}
          </span>
        )}
        
        {/* Right-click Trigger Prompt */}
        {showPrompt && !loading && (
          <span 
            onClick={triggerPriceFetch}
            className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-3 z-30 cursor-pointer select-none"
          >
            <span className="font-mono text-[10px] sm:text-[11px] text-emerald-400 font-extrabold uppercase px-2 py-1.5 border border-emerald-400 bg-black tracking-wide hover:bg-white hover:text-black transition-colors duration-150">
              [ GET CHEAPEST PRICE? ]
            </span>
          </span>
        )}

        {/* Loading Spinner / Fetch state */}
        {loading && (
          <span className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-3 z-30 select-none">
            <span className="font-mono text-[9px] sm:text-[10px] text-white/50 animate-pulse">[ FETCHING... ]</span>
          </span>
        )}
      </div>
      
      {/* Game Details */}
      <div className="flex-grow flex flex-col justify-between p-4 sm:p-5 space-y-4">
        <div className="flex justify-between items-stretch gap-3 min-h-[38px] sm:min-h-[42px]">
          <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
            <h4 className="text-white group-hover:text-black text-sm sm:text-base font-bold tracking-wide uppercase line-clamp-1 leading-snug flex items-center gap-1.5">
              <span>{cleanTitle(game.title)}</span>
              {hasItchBadge && (
                <span className="font-mono text-[8px] uppercase tracking-widest bg-[#fa5c5c] text-black border border-[#fa5c5c] font-black px-1 py-0.5 select-none shrink-0 leading-none">
                  itch.io
                </span>
              )}
              {hasGogBadge && (
                <span className="font-mono text-[8px] uppercase tracking-widest bg-[#7b3fc4] text-white border border-[#7b3fc4] font-black px-1 py-0.5 select-none shrink-0 leading-none">
                  DRM-Free
                </span>
              )}
            </h4>
            <span className="font-mono text-[10px] sm:text-xs text-white/60 group-hover:text-black/60 block font-bold mt-1.5 leading-normal">
              by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Dev"}
            </span>
          </div>

          {finalDeal && (() => {
            const storeKey = finalDeal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const dealUrl = `/re/${game.slug}/${storeKey}?gameId=${game.id}&fallbackUrl=${encodeURIComponent(finalDeal.dealUrl)}`;
            
            return (
              <span 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(dealUrl, "_blank", "noopener,noreferrer");
                }}
                className="px-2 border border-emerald-400 bg-emerald-950 text-emerald-400 font-mono text-[11px] font-black uppercase tracking-wider flex items-center justify-center shrink-0 h-full select-none transition-all duration-150 group-hover:border-black group-hover:bg-emerald-500 group-hover:text-black hover:!bg-black hover:!text-emerald-400 hover:!border-emerald-400 cursor-pointer"
                title={`Get on ${finalDeal.storeName} (${formatPrice(finalDeal.dealPrice, finalDeal.currency)})`}
              >
                {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
              </span>
            );
          })()}
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-white/15 font-mono text-[10px] sm:text-xs">
          <PlatformLogos platformNames={game.platformNames} />
          <span className="px-1.5 py-0.2 border border-white text-white group-hover:text-black group-hover:border-black font-bold">
            {game.status === "released" && game.releaseDate ? formatDate(game.releaseDate) : game.status}
          </span>
        </div>
      </div>
    </a>
  );
}

interface GameCatalogClientProps {
  initialGames: GameData[];
  initialTotalGames: number | null;
  initialNextCursor: string | null;
  heroGames?: any[];
  latestGames?: any[];
  trendingGames?: any[];
  upcomingGames?: any[];
  topRatedGames?: any[];
  catalogueTitle?: string;
  catalogueDesc?: string;
  supportTitle?: string;
  supportDesc?: string;
}

function GameCatalogClientInner({
  initialGames,
  initialTotalGames,
  initialNextCursor,
  heroGames = [],
  latestGames = [],
  trendingGames = [],
  upcomingGames = [],
  topRatedGames = [],
  catalogueTitle,
  catalogueDesc,
  supportTitle,
  supportDesc
}: GameCatalogClientProps) {
  const [games, setGames] = useState<GameData[]>(initialGames);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [sortBy, setSortBy] = useState<"latest" | "trending" | "top-rated">("latest");
  const [hasInitialFetchRun, setHasInitialFetchRun] = useState(false);
  const [activeRegion, setActiveRegion] = useState("US");
  const [mobileLayout, setMobileLayout] = useState<"grid" | "list">("grid");
  const [sortOpen, setSortOpen] = useState(false);
  const [isSemantic, setIsSemantic] = useState(false);
  const [pathname, setPathname] = useState("");
  const { vibes: explicitVibes } = usePreferences();
  const [bypassExpansion, setBypassExpansion] = useState(false);
  const [resolvedExpandedQuery, setResolvedExpandedQuery] = useState<string | null>(null);
  const [isBrowseAll, setIsBrowseAll] = useState(false);
  const [forceFetchToggle, setForceFetchToggle] = useState(0);

  // Reset expansion bypass and browse all when search query changes
  useEffect(() => {
    setBypassExpansion(false);
    setResolvedExpandedQuery(null);
    if (searchQuery.trim() !== "") {
      setIsBrowseAll(false);
    }
  }, [searchQuery]);

  // Hydrate states from URL parameters and localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPathname(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const query = params.get("search") || "";
      const sort = (params.get("sort") as "latest" | "trending" | "top-rated") || "latest";
      const mode = params.get("mode") === "semantic";
      
      setSearchQuery(query);
      setDebouncedSearch(query);
      setSortBy(sort);
      setIsSemantic(mode);

      // Persisted settings
      const savedLayout = localStorage.getItem("gata-mobile-layout");
      if (savedLayout === "list" || savedLayout === "grid") {
        setMobileLayout(savedLayout);
      }
      setActiveRegion(localStorage.getItem("gamegata_currency_region") || "US");
    }
  }, []);

  const handleGameClick = (gameId: string, index: number) => {
    if (debouncedSearch.trim()) {
      fetch("/api/search/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: debouncedSearch,
          gameId,
          position: index
        })
      }).catch(err => console.warn("Failed to log search click:", err));
    }
  };

  const handleFeelingLucky = async () => {
    if (!searchQuery.trim()) {
      window.location.assign("/random");
      return;
    }

    setLuckyLoading(true);
    try {
      const modeParam = isSemantic ? "&mode=semantic" : "";
      const response = await fetch(`/api/games?search=${encodeURIComponent(searchQuery)}&limit=10${modeParam}`);
      if (response.ok) {
        const data = await response.json();
        const fetchedGames: GameData[] = data.games || [];
        
        if (fetchedGames.length > 0) {
          const q = searchQuery.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
          
          let bestMatch = fetchedGames.find(g => {
            const t = g.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            return t === q;
          });

          if (!bestMatch) {
            bestMatch = fetchedGames.find(g => {
              const t = g.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
              return t.includes(q) || q.includes(t);
            });
          }

          if (!bestMatch) {
            bestMatch = fetchedGames[0];
          }

          if (bestMatch) {
            window.location.assign(`/game/${bestMatch.slug}`);
            return;
          }
        }
      }
      alert(`[ ERROR: LUCK OUT OF BOUNDS ]\nNo close match found for "${searchQuery}".`);
    } catch (e) {
      console.error("I'm feeling lucky search failed", e);
    } finally {
      setLuckyLoading(false);
    }
  };

  // Sync mobile layout listener
  useEffect(() => {
    const handleLayoutChange = () => {
      const currentSaved = localStorage.getItem("gata-mobile-layout");
      if (currentSaved === "list" || currentSaved === "grid") {
        setMobileLayout(currentSaved);
      }
    };
    window.addEventListener("gata-mobile-layout-changed", handleLayoutChange);
    return () => window.removeEventListener("gata-mobile-layout-changed", handleLayoutChange);
  }, []);

  // Sync region settings listener
  useEffect(() => {
    const handleUpdate = () => {
      setActiveRegion(localStorage.getItem("gamegata_currency_region") || "US");
    };
    window.addEventListener("gamegata_currency_updated", handleUpdate);
    return () => window.removeEventListener("gamegata_currency_updated", handleUpdate);
  }, []);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Sync states with browser URL search parameters dynamically
  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    const params = new URLSearchParams();
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
      if (isSemantic) params.set("mode", "semantic");
    }
    if (sortBy && sortBy !== "latest") params.set("sort", sortBy);

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    const currentQuery = window.location.search;
    const expectedQuery = queryString ? `?${queryString}` : "";
    if (currentQuery !== expectedQuery) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [debouncedSearch, isSemantic, sortBy, pathname]);

  useEffect(() => {
    async function fetchCatalogGames() {
      // Don't run fetch on storefront page
      if (!isBrowseAll && !debouncedSearch) {
        setHasInitialFetchRun(true);
        return;
      }
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) {
          queryParams.set("search", debouncedSearch);
          if (isSemantic) queryParams.set("mode", "semantic");
          if (bypassExpansion) queryParams.set("expand", "false");
        }
        if (!debouncedSearch && explicitVibes && explicitVibes.length > 0) {
          queryParams.set("tags", explicitVibes.join(","));
        }
        if (sortBy) queryParams.set("sort", sortBy);
        queryParams.set("limit", "20");

        const response = await fetch(`/api/games?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
          setNextCursor(data.nextCursor || null);
          setResolvedExpandedQuery(data.expandedQuery || null);
        }
      } catch (err) {
        console.error("❌ Error fetching catalog:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCatalogGames();
  }, [debouncedSearch, isSemantic, sortBy, hasInitialFetchRun, explicitVibes, bypassExpansion, isBrowseAll, forceFetchToggle]);

  const handleBrowseAll = (tab: "latest" | "trending" | "top-rated" | "upcoming") => {
    if (tab === "upcoming") {
      window.location.assign("/upcoming");
      return;
    }
    const targetSort = tab === "top-rated" ? "top-rated" : tab === "latest" ? "latest" : "trending";
    window.location.assign(`/games?sort=${targetSort}`);
  };

  async function loadMoreGames() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const queryParams = new URLSearchParams();
      if (debouncedSearch) {
        queryParams.set("search", debouncedSearch);
        if (isSemantic) queryParams.set("mode", "semantic");
        if (bypassExpansion) queryParams.set("expand", "false");
      }
      if (!debouncedSearch && explicitVibes && explicitVibes.length > 0) {
        queryParams.set("tags", explicitVibes.join(","));
      }
      if (sortBy) queryParams.set("sort", sortBy);
      queryParams.set("cursor", nextCursor);
      queryParams.set("limit", "20");

      const response = await fetch(`/api/games?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setGames((prev) => {
          const incoming: GameData[] = data.games || [];
          const existingIds = new Set(prev.map((g) => g.id));
          const filteredIncoming = incoming.filter((g) => !existingIds.has(g.id));
          return [...prev, ...filteredIncoming];
        });
        setNextCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error("❌ Error fetching next page:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  const findCheapestDeal = (game: GameData) => {
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

  const showStorefront = !debouncedSearch && !isBrowseAll;

  return (
    <div className="space-y-8">
      {showStorefront && heroGames && heroGames.length > 0 && (
        <HeroCarousel games={heroGames} activeRegion={activeRegion} />
      )}

      {/* ── Search Section (Code kept for future use) ── */}
      {false && (
        <section className="space-y-3">
          {/* Main search row */}
          <div className="flex gap-2">
            {/* Search input with vibe toggle embedded on the right */}
            <div className="relative flex-1" data-tour="search-bar">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-white/50" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isSemantic ? "Describe vibes, concepts, settings... (e.g. 'alien isolation but co-op')" : "Search by title, developer, genre, tag..."}
                className="block w-full pl-10 pr-36 py-3.5 bg-black border border-white/30 focus:border-white rounded-none focus:outline-none text-sm text-white placeholder-white/45 transition-all duration-200 font-medium tracking-wide"
              />
              {/* Vibe toggle — right side of the input */}
              <button
                onClick={() => setIsSemantic(prev => !prev)}
                title={isSemantic ? "Switch to exact search" : "Switch to vibe / AI search"}
                className={`absolute inset-y-0 right-0 flex items-center gap-1.5 px-3 border-l font-mono text-[10px] font-bold uppercase tracking-widest transition-all duration-150 cursor-pointer select-none ${
                  isSemantic
                    ? "bg-white text-black border-white"
                    : "bg-black text-white/40 border-white/20 hover:text-white hover:border-white/50"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{isSemantic ? "VIBE ON" : "VIBE"}</span>
              </button>
              {debouncedSearch && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-20 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors duration-150"
                >
                  <span className="font-mono text-[10px] font-bold">[✕]</span>
                </button>
              )}
            </div>

            {/* I'm Feeling Lucky — prominent standalone button */}
            <button
              onClick={handleFeelingLucky}
              disabled={luckyLoading}
              title={searchQuery.trim() ? `Jump to best match for "${searchQuery}"` : "Open a random game"}
              className="shrink-0 px-4 py-3.5 bg-black border border-white/30 text-white hover:border-white hover:bg-white hover:text-black transition-all duration-150 rounded-none cursor-pointer font-mono text-[11px] font-bold uppercase tracking-wider whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[50px]"
            >
              {luckyLoading ? (
                <span className="animate-pulse">[ ... ]</span>
              ) : (
                <>
                  <span className="text-base leading-none" aria-hidden="true">🎲</span>
                  <span className="hidden sm:inline">I'M FEELING LUCKY</span>
                  <span className="sm:hidden">LUCKY</span>
                </>
              )}
            </button>
          </div>

          {/* Vibe mode description — only visible when vibe is on */}
          {isSemantic && (
            <p className="font-mono text-[10px] text-white/40 tracking-wide">
              Vibe Search is ON — describe any mood, setting, or concept and we'll find matching games.
            </p>
          )}
        </section>
      )}

      {/* Catalog Mapping Grid */}
      <section className="space-y-6 relative mt-6">
        {resolvedExpandedQuery && (
          <div className="font-mono text-xs text-white/60 select-none pb-2 border-b border-white/10 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              Showing results for <span className="text-white font-bold italic">"{resolvedExpandedQuery}"</span>.
            </div>
            <div>
              Did you mean to search for:{" "}
              <button 
                onClick={() => setBypassExpansion(true)}
                className="text-red-400 hover:text-red-300 underline font-bold cursor-pointer transition-colors duration-150 decoration-dotted bg-transparent border-none p-0 outline-none"
              >
                "{debouncedSearch}"
              </button>?
            </div>
          </div>
        )}
        {/* Back to storefront link (used when browsing all category tabs) */}
        {isBrowseAll && (
          <div className="flex justify-start mb-6">
            <button
              onClick={() => setIsBrowseAll(false)}
              className="flex items-center gap-1 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-all duration-150 px-3 py-2 cursor-pointer font-mono text-[11px] font-bold uppercase tracking-wider animate-pulse"
            >
              [ BACK TO STOREFRONT ]
            </button>
          </div>
        )}

        {/* Sort and detail rows (Code kept for future use) */}
        {false && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-mono text-[11px] sm:text-xs tracking-wider uppercase text-white font-bold border-b border-white/20 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                {!debouncedSearch ? (
                  <div className="relative">
                    <button
                      onClick={() => setSortOpen(!sortOpen)}
                      className="px-3 py-1.5 border border-white/30 text-white hover:border-white transition-all duration-150 rounded-none cursor-pointer flex items-center gap-1.5 uppercase font-bold"
                    >
                      SORT: {sortBy} <span className="text-[9px] sm:text-[10px]">▼</span>
                    </button>
                    {sortOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />
                        <div className="absolute left-0 mt-1.5 w-32 bg-black border border-white z-40 flex flex-col divide-y divide-white/25">
                          <button
                            onClick={() => {
                              setSortBy("latest");
                              setSortOpen(false);
                            }}
                            className={`px-3 py-2 text-left hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer font-bold ${
                              sortBy === "latest" ? "bg-white/10 text-white" : "text-white"
                            }`}
                          >
                            [ LATEST ]
                          </button>
                          <button
                            onClick={() => {
                              setSortBy("trending");
                              setSortOpen(false);
                            }}
                            className={`px-3 py-2 text-left hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer font-bold ${
                              sortBy === "trending" ? "bg-white/10 text-white" : "text-white"
                            }`}
                          >
                            [ TRENDING ]
                          </button>
                          <button
                            onClick={() => {
                              setSortBy("top-rated");
                              setSortOpen(false);
                            }}
                            className={`px-3 py-2 text-left hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer font-bold ${
                              sortBy === "top-rated" ? "bg-white/10 text-white" : "text-white"
                            }`}
                          >
                            [ TOP RATED ]
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-white/70 font-bold py-1.5 font-mono">
                    [ FOUND {games.length} GAME{games.length !== 1 ? "S" : ""} ]
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono font-bold">
                {isBrowseAll && (
                  <button
                    onClick={() => setIsBrowseAll(false)}
                    className="flex items-center gap-1 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-all duration-150 px-2.5 py-1.5 cursor-pointer"
                  >
                    [ STOREFRONT ]
                  </button>
                )}
                <a
                  href="/upcoming"
                  className="flex items-center gap-1 border border-white/25 px-2.5 py-1.5 hover:border-white hover:bg-white hover:text-black transition-all duration-150"
                >
                  <Calendar className="w-3.5 h-3.5" /> UPCOMING
                </a>
                <a
                  href="/random"
                  className="flex items-center gap-1 border border-white/25 px-2.5 py-1.5 hover:border-white hover:bg-white hover:text-black transition-all duration-150"
                >
                  <Sparkles className="w-3.5 h-3.5" /> RANDOM
                </a>
              </div>
            </div>  
          </div>
        )}

        {showStorefront ? (
          <>
            <TabCatalog
              latest={latestGames}
              trending={trendingGames}
              upcoming={upcomingGames}
              topRated={topRatedGames}
              activeRegion={activeRegion}
              onBrowseAll={handleBrowseAll}
            />
            <StorefrontLists
              latest={latestGames}
              trending={trendingGames}
              activeRegion={activeRegion}
              onExplore={() => handleBrowseAll("latest")}
              catalogueTitle={catalogueTitle}
              catalogueDesc={catalogueDesc}
              supportTitle={supportTitle}
              supportDesc={supportDesc}
            />
          </>
        ) : loading ? (
          <NyanLoader message="INGESTING CATALOG CONTENT..." />
        ) : games.length === 0 ? (
          <div className="text-center py-16 border border-white font-mono text-xs text-white uppercase tracking-widest font-bold w-full">
            [ No horror titles match your current criteria ]
          </div>
        ) : (
          <div className="space-y-8">
            <div className={mobileLayout === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"}>
              {games.map((game, index) => (
                <GameCard
                  key={game.id}
                  game={game}
                  index={index}
                  activeRegion={activeRegion}
                  findCheapestDeal={findCheapestDeal}
                  mobileLayout={mobileLayout}
                  onClick={() => handleGameClick(game.id, index)}
                />
              ))}
            </div>

            {nextCursor && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={loadMoreGames}
                  disabled={loadingMore}
                  className="font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-6 py-3 rounded-none font-bold disabled:opacity-50"
                >
                  {loadingMore ? "[ Hang On... ]" : "[ Load More ]"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function GameCatalogClient(props: GameCatalogClientProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <GameCatalogClientInner {...props} />
      </CartProvider>
    </AuthProvider>
  );
}
