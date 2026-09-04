"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CartProvider, useCart } from "../context/CartContext";
import { Heart, Check } from "lucide-react";

interface TrackControlsProps {
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  genres: string[];
  siteRating: number | null;
  steamRating: number | null;
  initialWishlisted?: boolean;
  initialCollectionStatus?: string | null;
  coverUrl?: string | null;
  initialPriceSnapshots?: any[];
  initialLikesCount?: number;
  compactOnly?: boolean;
  isItchGame?: boolean;
}

interface JournalItem {
  gameId: string;
  gameTitle: string;
  action: string;
  value: string;
  timestamp: number;
}

function TrackControlsInner({
  gameId,
  gameSlug,
  gameTitle,
  genres = [],
  siteRating = null,
  steamRating = null,
  initialWishlisted = false,
  initialCollectionStatus = null,
  coverUrl = null,
  initialPriceSnapshots = [],
  initialLikesCount = 0,
  compactOnly = false,
  isItchGame = false,
}: TrackControlsProps) {
  const { user } = useAuth();
  const { cartItems, addToCart, removeFromCart } = useCart();
  const isInCart = cartItems.some(item => item.gameId === gameId);

  const [wishlisted, setWishlisted] = useState<boolean>(initialWishlisted);
  const [likesCount, setLikesCount] = useState<number>(initialLikesCount);
  const [collectionStatus, setCollectionStatus] = useState<string | null>(initialCollectionStatus);
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [history, setHistory] = useState<JournalItem[]>([]);
  const [similarStats, setSimilarStats] = useState<{ count: number; avgRating: number | null }>({ count: 0, avgRating: null });
  const [journalExpanded, setJournalExpanded] = useState<boolean>(false);

  // Sync initial props
  useEffect(() => {
    setWishlisted(initialWishlisted);
  }, [initialWishlisted]);

  useEffect(() => {
    setCollectionStatus(initialCollectionStatus);
  }, [initialCollectionStatus]);

  // Fetch real status from Turso DB on mount if user is logged in
  useEffect(() => {
    async function fetchStatus() {
      if (!user) return;
      try {
        const res = await fetch(`/api/user/status?gameId=${gameId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) {
            setWishlisted(!!data.status.wishlisted);
            setCollectionStatus(data.status.status || null);
            setRating(data.status.rating || null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch game user status:", err);
      }
    }

    fetchStatus();
  }, [gameId, user]);

  // Load client-only localStorage states
  useEffect(() => {
    setMounted(true);

    const libRaw = localStorage.getItem("gamegata_library");
    const library = libRaw ? JSON.parse(libRaw) : {};

    // Get current game's rating
    if (library[gameId]) {
      setRating(library[gameId].rating || null);
    } else {
      setRating(null);
    }

    // Get activity history for this game
    const journalRaw = localStorage.getItem("gamegata_journal");
    const journal = journalRaw ? JSON.parse(journalRaw) : [];
    const gameHistory = journal.filter((item: JournalItem) => item.gameId === gameId);
    setHistory(gameHistory);

    // Compute stats for similar games
    const otherGames = Object.values(library).filter(
      (item: any) => item.gameId !== gameId
    );
    const similarGames = otherGames.filter((item: any) => {
      const itemGenres = item.genres || [];
      return itemGenres.some((g: string) => genres.includes(g));
    });

    const ratedSimilar = similarGames.filter((item: any) => item.rating !== null);
    const avg = ratedSimilar.length > 0
      ? ratedSimilar.reduce((acc: number, cur: any) => acc + (cur.rating || 0), 0) / ratedSimilar.length
      : null;

    setSimilarStats({
      count: similarGames.length,
      avgRating: avg,
    });
  }, [gameId, wishlisted, collectionStatus]);

  const handleAuthRedirect = () => {
    window.location.assign(`/login?redirect=${encodeURIComponent(`/game/${gameSlug}`)}`);
  };

  const handleCartToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      await removeFromCart(gameId);
    } else {
      const gameMock = {
        id: gameId,
        title: gameTitle,
        slug: gameSlug,
        coverUrl,
        priceSnapshots: effectiveSnapshots,
      };
      await addToCart(gameMock);
    }
  };

  const toggleWishlist = async () => {
    if (!user) {
      handleAuthRedirect();
      return;
    }

    const nextWishlisted = !wishlisted;
    const delta = nextWishlisted ? 1 : -1;

    // Optimistic UI update for immediate response
    setWishlisted(nextWishlisted);
    setLikesCount(prev => Math.max(0, prev + delta));

    setLoading(true);
    const method = wishlisted ? "DELETE" : "POST";
    try {
      const res = await fetch("/api/user/wishlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const libRaw = localStorage.getItem("gamegata_library");
        const library = libRaw ? JSON.parse(libRaw) : {};
        const existing = library[gameId] || {
          gameId,
          gameTitle,
          gameSlug,
          genres,
          wishlisted: false,
          status: collectionStatus,
          rating: null,
          updatedAt: Date.now()
        };
        existing.wishlisted = nextWishlisted;
        existing.updatedAt = Date.now();
        library[gameId] = existing;
        localStorage.setItem("gamegata_library", JSON.stringify(library));

        const journalRaw = localStorage.getItem("gamegata_journal");
        const journal = journalRaw ? JSON.parse(journalRaw) : [];
        const entry: JournalItem = {
          gameId,
          gameTitle,
          action: "wishlist",
          value: nextWishlisted ? "Added to Favorites" : "Removed from Favorites",
          timestamp: Date.now()
        };
        journal.unshift(entry);
        localStorage.setItem("gamegata_journal", JSON.stringify(journal.slice(0, 100)));
        setHistory(journal.filter((item: JournalItem) => item.gameId === gameId));
      } else {
        // Revert on server error
        setWishlisted(wishlisted);
        setLikesCount(prev => Math.max(0, prev - delta));
      }
    } catch (err) {
      console.error("Failed to toggle wishlist:", err);
      setWishlisted(wishlisted);
      setLikesCount(prev => Math.max(0, prev - delta));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusClick = async (newStatus: string) => {
    if (!user) {
      handleAuthRedirect();
      return;
    }

    setLoading(true);
    const nextStatus = collectionStatus === newStatus ? null : newStatus;

    try {
      const res = await fetch("/api/user/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, status: nextStatus }),
      });

      if (res.ok) {
        setCollectionStatus(nextStatus);

        const libRaw = localStorage.getItem("gamegata_library");
        const library = libRaw ? JSON.parse(libRaw) : {};
        const existing = library[gameId] || {
          gameId,
          gameTitle,
          gameSlug,
          genres,
          wishlisted,
          status: null,
          rating: null,
          updatedAt: Date.now()
        };
        existing.status = nextStatus;
        existing.updatedAt = Date.now();
        library[gameId] = existing;
        localStorage.setItem("gamegata_library", JSON.stringify(library));

        const journalRaw = localStorage.getItem("gamegata_journal");
        const journal = journalRaw ? JSON.parse(journalRaw) : [];
        const statusObj = statuses.find(s => s.value === nextStatus);
        const actionVal = nextStatus && statusObj ? `Marked as ${statusObj.label}` : "Cleared status";

        const entry: JournalItem = {
          gameId,
          gameTitle,
          action: "status",
          value: actionVal,
          timestamp: Date.now()
        };
        journal.unshift(entry);
        localStorage.setItem("gamegata_journal", JSON.stringify(journal.slice(0, 100)));
        setHistory(journal.filter((item: JournalItem) => item.gameId === gameId));
      }
    } catch (err) {
      console.error("Failed to set status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = async (newRating: number | null) => {
    if (!user) {
      handleAuthRedirect();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, rating: newRating }),
      });

      if (res.ok) {
        setRating(newRating);

        const libRaw = localStorage.getItem("gamegata_library");
        const library = libRaw ? JSON.parse(libRaw) : {};
        const existing = library[gameId] || {
          gameId,
          gameTitle,
          gameSlug,
          genres,
          wishlisted,
          status: collectionStatus,
          rating: null,
          updatedAt: Date.now()
        };
        existing.rating = newRating;
        existing.updatedAt = Date.now();
        library[gameId] = existing;
        localStorage.setItem("gamegata_library", JSON.stringify(library));

        const journalRaw = localStorage.getItem("gamegata_journal");
        const journal = journalRaw ? JSON.parse(journalRaw) : [];
        const entry: JournalItem = {
          gameId,
          gameTitle,
          action: "rating",
          value: newRating !== null ? `Rated ${newRating}/10` : "Cleared rating",
          timestamp: Date.now()
        };
        journal.unshift(entry);
        localStorage.setItem("gamegata_journal", JSON.stringify(journal.slice(0, 100)));
        setHistory(journal.filter((item: JournalItem) => item.gameId === gameId));
      }
    } catch (err) {
      console.error("Failed to set rating:", err);
    } finally {
      setLoading(false);
    }
  };

  const statuses = [
    { label: "Playing", value: "PLAYING" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Plan to Play", value: "WANT_TO_PLAY" },
    { label: "Owned", value: "OWNED" },
  ];

  const isItch = isItchGame || gameSlug.startsWith("itch-");

  // Strictly isolate itch games to itch.io deals
  const effectiveSnapshots = isItch
    ? (initialPriceSnapshots || []).filter((s: any) =>
        s && (
          (s.storeName && (s.storeName.toLowerCase() === "itch.io" || s.storeName.toLowerCase() === "itch")) ||
          s.provider === "itch" ||
          (s.dealUrl && s.dealUrl.includes("itch.io"))
        )
      )
    : (initialPriceSnapshots || []);

  const cheapestDeal = effectiveSnapshots.length > 0
    ? [...effectiveSnapshots].sort((a, b) => a.dealPrice - b.dealPrice)[0]
    : null;

  const storeKey = cheapestDeal
    ? cheapestDeal.storeName.toLowerCase().replace(/[^a-z0-9]/g, "")
    : (isItch ? "itchio" : "steam");

  const buyNowUrl = cheapestDeal
    ? `/re/${gameSlug}/${storeKey}?gameId=${gameId}&fallbackUrl=${encodeURIComponent(cheapestDeal.dealUrl)}`
    : (isItch ? `/re/${gameSlug}/itchio?gameId=${gameId}` : `/re/${gameSlug}/steam`);

  if (compactOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 select-none">
        {/* Buy Now Button */}
        <a
          href={buyNowUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-white/90 font-sans text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer shadow-md hover:scale-[0.98] border border-white"
        >
          <span>
            {isItch
              ? (cheapestDeal && cheapestDeal.dealPrice === 0 ? "Play Free" : "Buy Now")
              : "Buy Now"}
          </span>
          {cheapestDeal && cheapestDeal.dealPrice > 0 && (
            <span className="text-[11px] font-semibold text-black/70">
              ({cheapestDeal.currency === "EUR" ? "€" : cheapestDeal.currency === "GBP" ? "£" : "$"}{cheapestDeal.dealPrice.toFixed(2)})
            </span>
          )}
        </a>

        {/* Add to Cart Button */}
        <button
          onClick={handleCartToggle}
          disabled={loading}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold font-sans transition-all duration-300 cursor-pointer rounded-xl border active:scale-95 ${
            isInCart
              ? "bg-purple-600 text-white border-purple-500 shadow-md animate-in fade-in zoom-in-95 duration-200"
              : "bg-white/5 text-white/90 border-white/15 hover:bg-white/15 hover:border-white/30"
          }`}
        >
          {isInCart ? (
            <>
              <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span>In Cart</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span>Add to Cart</span>
            </>
          )}
        </button>

        {/* Add to Favorite Button with Live Likes Counter */}
        <button
          onClick={toggleWishlist}
          disabled={loading}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold font-sans transition-all duration-300 cursor-pointer rounded-xl border active:scale-95 ${
            wishlisted
              ? "bg-red-950/80 text-red-400 border-red-500/40 shadow-md animate-in fade-in zoom-in-95 duration-200"
              : "bg-white/5 text-white/90 border-white/15 hover:bg-white/15 hover:border-white/30"
          }`}
          title={wishlisted ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-current text-red-400 scale-110" : "text-white/70"}`} />
          <span>{wishlisted ? "Favorited" : "Favorite"}</span>
          <span className={`font-mono text-[11px] font-semibold border-l pl-2 ml-0.5 ${wishlisted ? "border-red-500/30 text-red-300" : "border-white/20 text-white/60"}`}>
            {likesCount.toLocaleString()}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative border border-white/5 p-5 bg-[#131316]/50 text-xs flex flex-col justify-between gap-4 flex-1 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-20 filter blur-[2px] transition-all duration-500 hover:scale-105"
        style={{ backgroundImage: "url('/graphic1.jpg')" }}
      />
      <div className="absolute inset-0 z-0 bg-black/30 pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between h-full gap-5 flex-1">
        <div>
          <span className="text-[12px] text-neutral-450 uppercase tracking-widest block border-b border-white/5 pb-2 font-bold">
            My Tracking Journal
          </span>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <button
                onClick={toggleWishlist}
                disabled={loading}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border font-semibold transition-all duration-150 cursor-pointer h-[38px] select-none rounded-xl text-xs w-full ${
                  wishlisted
                    ? "bg-white text-black border-white"
                    : "bg-white/5 text-white border-white/10 hover:bg-white hover:text-black"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-black text-black" : "fill-transparent text-white"}`} />
                <span>{wishlisted ? "Favorited" : "Favorite"}</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleCartToggle}
                disabled={loading}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border font-semibold transition-all duration-150 cursor-pointer h-[38px] select-none rounded-xl text-xs w-full ${
                  isInCart
                    ? "bg-emerald-600/90 text-white border-emerald-600/10"
                    : "bg-white/5 text-white border-white/10 hover:bg-white hover:text-black"
                }`}
              >
                {isInCart ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>In Cart</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    <span>Add to Cart</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-neutral-450 font-semibold uppercase tracking-wider">
              My Progress
            </span>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map((s) => {
                const active = collectionStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => handleStatusClick(s.value)}
                    disabled={loading}
                    className={`py-2 px-1 text-center font-medium text-[11px] transition-all duration-150 border cursor-pointer truncate h-[34px] flex items-center justify-center rounded-xl ${
                      active
                        ? "bg-white text-black border-white font-semibold"
                        : "bg-white/5 text-white border-white/5 hover:bg-white hover:text-black"
                    }`}
                  >
                    {active ? `✓ ${s.label}` : s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {journalExpanded && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-neutral-450 font-semibold uppercase tracking-wider">
                My Rating
              </span>
              <select
                value={rating || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handleRatingChange(val ? parseInt(val) : null);
                }}
                className="bg-white/5 text-white border border-white/10 p-2 text-xs font-medium w-full rounded-xl focus:outline-none cursor-pointer h-[38px] focus:border-white/30"
              >
                <option value="" className="bg-zinc-950">Select Rating</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num} className="bg-zinc-950">
                    {num} / 10
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setJournalExpanded((prev) => !prev)}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors border-t border-white/5 pt-3"
        >
          <span>{journalExpanded ? 'Hide details ↑' : 'Open full journal ↓'}</span>
        </button>

        {journalExpanded && (
          <div className="border-t border-white/5 pt-4 flex flex-col gap-1">
            <span className="text-[10px] text-neutral-455 font-bold uppercase tracking-widest mb-1">
              Comparison to Similar Games
            </span>
            {mounted && similarStats ? (
              <div className="space-y-1.5 text-neutral-350 font-mono text-[10px] uppercase">
                <div>
                  • Similar Genres: <span className="text-white font-medium">{genres.slice(0, 2).join(", ") || "None"}</span>
                </div>
                <div>
                  • Games Played/Rated: <span className="text-white font-medium">{similarStats.count}</span>
                </div>
                {similarStats.avgRating !== null ? (
                  <div>
                    • Your Average: <span className="text-white font-medium">{similarStats.avgRating.toFixed(1)}/10</span>
                    {rating !== null && (
                      <span className="text-white/40 ml-1.5">
                        ({rating > similarStats.avgRating ? "+" : ""}{(rating - similarStats.avgRating).toFixed(1)} vs avg)
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    • Your Average: <span className="text-white/30 italic">N/A</span>
                  </div>
                )}
                {siteRating !== null && (
                  <div>
                    • Site Average: <span className="text-white font-medium">{siteRating.toFixed(1)}/10</span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-white/30 italic text-[10px] uppercase font-mono">[ Loading Stats... ]</span>
            )}
          </div>
        )}

        {journalExpanded && (
          <div className="border-t border-white/5 pt-4 flex-1 flex flex-col gap-1">
            <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mb-1">
              Activity Log
            </span>
            <div className="space-y-2 overflow-y-auto max-h-[85px] pr-1 scrollbar-thin">
              {mounted ? (
                history.length > 0 ? (
                  history.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-baseline text-[9px] font-mono text-neutral-350 uppercase">
                      <span className="truncate max-w-[170px]">{item.value}</span>
                      <span className="text-white/30 shrink-0 text-[8px] ml-1">
                        {new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-white/35 italic text-[9px] uppercase font-mono block">No activity logged yet.</span>
                )
              ) : (
                <span className="text-white/35 italic text-[9px] uppercase font-mono block">[ Loading Log... ]</span>
              )}
            </div>
          </div>
        )}

        {!user && (
          <span className="text-[12px] text-white/55 block border-t border-white/5 pt-2 leading-snug">
            * Sign in to sync your status to the server database.
          </span>
        )}
      </div>
    </div>
  );
}

export default function TrackControls(props: TrackControlsProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <TrackControlsInner {...props} />
      </CartProvider>
    </AuthProvider>
  );
}
