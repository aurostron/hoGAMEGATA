import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { getCloudinaryFetchUrl } from "../lib/utils";
import { initSearchEngine, searchLocal, isSearchReady } from "../lib/clientSearchEngine";

interface GameSearchResult {
  id: string;
  title: string;
  slug: string;
  coverUrl?: string | null;
  developerNames: string | null;
  priceBadge?: string | null;
  badgeType?: "free" | "sale" | "paid";
}

// Client-side in-memory LRU response cache (max 100 entries)
const clientSearchCache = new Map<string, GameSearchResult[]>();
const MAX_CACHE_ENTRIES = 100;

// Session price cache: persists live prices for visible games until page refresh
const sessionPriceCache = new Map<string, { priceBadge: string; badgeType: "free" | "sale" | "paid" }>();

function getCachedResults(key: string): GameSearchResult[] | undefined {
  return clientSearchCache.get(key.toLowerCase().trim());
}

function setCachedResults(key: string, data: GameSearchResult[]) {
  const cleanKey = key.toLowerCase().trim();
  if (clientSearchCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = clientSearchCache.keys().next().value;
    if (firstKey) clientSearchCache.delete(firstKey);
  }
  clientSearchCache.set(cleanKey, data);
}

export default function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const priceAbortRef = useRef<AbortController | null>(null);
  const priceDebounceRef = useRef<any>(null);

  const activeQueryRef = useRef(query);
  activeQueryRef.current = query;

  // Pre-warm client search engine on idle or first user interaction
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(() => initSearchEngine());
      } else {
        setTimeout(() => initSearchEngine(), 1500);
      }
    }
  }, []);

  // Search logic: 100% Client-side IndexedDB engine first (0ms, 0 Turso reads)
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      abortControllerRef.current?.abort();
      priceAbortRef.current?.abort();
      clearTimeout(priceDebounceRef.current);
      return;
    }

    // 1. Instant cache check (0ms response, 0 network requests)
    const cached = getCachedResults(trimmedQuery);
    if (cached) {
      setResults(cached);
      setIsOpen(true);
      setLoading(false);
      abortControllerRef.current?.abort();
      return;
    }

    // 2. Try Client-side In-Memory / IndexedDB search engine (0 Turso reads)
    const localMatches = searchLocal(trimmedQuery, 8);
    if (localMatches.length > 0) {
      // Map local matches using sessionPriceCache (no fake/assumed badges!)
      const gamesWithDefaults: GameSearchResult[] = localMatches.map((m) => {
        const cachedPrice = sessionPriceCache.get(m.id);
        return {
          ...m,
          priceBadge: cachedPrice?.priceBadge || null,
          badgeType: cachedPrice?.badgeType || "paid",
          coverUrl: cachedPrice?.coverUrl || m.coverUrl || null,
        };
      });

      setResults(gamesWithDefaults);
      setIsOpen(true);
      setLoading(false);
      setCachedResults(trimmedQuery, gamesWithDefaults);
      abortControllerRef.current?.abort();

      // On-demand fetch live prices for visible games missing from session cache
      const missingIds = gamesWithDefaults
        .filter((g) => !sessionPriceCache.has(g.id))
        .map((g) => g.id);

      if (missingIds.length > 0) {
        priceAbortRef.current?.abort();
        const priceController = new AbortController();
        priceAbortRef.current = priceController;

        clearTimeout(priceDebounceRef.current);
        priceDebounceRef.current = setTimeout(() => {
          fetch(`/api/prices/quick?ids=${missingIds.join(",")}`, {
            signal: priceController.signal,
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && data.prices) {
                for (const [id, priceInfo] of Object.entries(data.prices as Record<string, any>)) {
                  sessionPriceCache.set(id, priceInfo);
                }

                setResults((prev) =>
                  prev.map((g) => {
                    const fresh = data.prices[g.id];
                    if (fresh) {
                      return {
                        ...g,
                        priceBadge: fresh.priceBadge,
                        badgeType: fresh.badgeType,
                        coverUrl: fresh.coverUrl || g.coverUrl,
                      };
                    }
                    return g;
                  })
                );
              }
            })
            .catch(() => {});
        }, 200);
      }
      return;
    }

    // 3. Fallback to Cloud Edge API if local index is still downloading or no local match
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    const debounceTimer = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.games) {
            const fetchedGames: GameSearchResult[] = data.games || [];
            setCachedResults(trimmedQuery, fetchedGames);

            if (activeQueryRef.current.trim() === trimmedQuery) {
              setResults(fetchedGames);
              setIsOpen(true);
            }
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Header search suggest error:", err);
          }
        })
        .finally(() => {
          if (activeQueryRef.current.trim() === trimmedQuery) {
            setLoading(false);
          }
        });
    }, 200);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query]);

  // Click outside to close dropdown and collapse search if empty
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (!query.trim()) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        if (!query.trim()) {
          setIsExpanded(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  const handleSelectGame = (slug: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nextjs-route-start"));
      window.location.assign(`/game/${slug}`);
    }
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative h-full flex items-center">
      {/* Collapsed Search Button */}
      {!isExpanded ? (
        <button
          onMouseEnter={() => initSearchEngine()}
          onFocus={() => initSearchEngine()}
          onClick={() => {
            initSearchEngine();
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center justify-center text-white hover:bg-white/5 w-9 sm:w-11 h-full transition-colors duration-150 cursor-pointer rounded-xl"
          title="Search"
        >
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      ) : (
        /* Expanded Search Input Bar */
        <div className="fixed inset-x-0 top-0 h-14 bg-[#0d0d0f] z-50 px-3 flex items-center shadow-xl border-b border-white/10 sm:relative sm:inset-auto sm:top-auto sm:h-auto sm:bg-transparent sm:z-auto sm:px-0 sm:shadow-none sm:border-none sm:w-64">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {loading ? (
                <Loader2 className="h-4 w-4 text-white/70 animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-white/70" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim() && setIsOpen(true)}
              placeholder="Search horror games..."
              className="block w-full h-9 pl-9 pr-9 bg-[#141418] border border-white/20 focus:border-white/50 text-xs text-white placeholder-white/40 focus:outline-none rounded-xl transition-all duration-150 font-sans tracking-wide"
            />
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setIsOpen(false);
                setIsExpanded(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white transition-colors duration-150 cursor-pointer"
            >
              <span className="text-xs font-mono font-bold">✕</span>
            </button>
          </div>
        </div>
      )}

      {/* Autocomplete Dropdown list */}
      {isOpen && isExpanded && (
        <div className="fixed top-14 left-3 right-3 sm:absolute sm:top-full sm:left-auto sm:right-0 mt-1.5 sm:w-80 bg-black/95 backdrop-blur-md border border-white/20 rounded-xl z-50 divide-y divide-white/10 max-h-80 overflow-y-auto shadow-2xl flex flex-col">
          {results.length > 0 ? (
            results.map((game) => (
              <button
                key={game.id}
                onClick={() => handleSelectGame(game.slug)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white hover:text-black transition-colors duration-150 cursor-pointer flex items-center gap-3 select-none outline-none border-none bg-transparent group"
              >
                {game.coverUrl ? (
                  <img
                    src={getCloudinaryFetchUrl(game.coverUrl, false, game.slug, "cover") || game.coverUrl}
                    alt={game.title}
                    className="w-8 h-10 object-cover rounded shadow border border-white/10 shrink-0 group-hover:border-black/20"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-8 h-10 bg-white/10 rounded flex items-center justify-center shrink-0 text-[10px] font-mono text-white/40">
                    ?
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-xs font-bold tracking-tight truncate block">
                      {game.title}
                    </span>
                    {game.priceBadge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider ${
                          game.badgeType === "free"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 group-hover:border-emerald-600 group-hover:text-emerald-700"
                            : game.badgeType === "sale"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/25 group-hover:border-amber-600 group-hover:text-amber-700"
                            : "bg-white/10 text-white/70 border border-white/10 group-hover:border-black/20 group-hover:text-black/70"
                        }`}
                      >
                        {game.priceBadge}
                      </span>
                    )}
                  </div>
                  {game.developerNames && (
                    <span className="font-mono text-[9px] text-white/50 group-hover:text-black/60 truncate block font-medium transition-colors">
                      by {game.developerNames}
                    </span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-[10px] font-mono text-white/40 uppercase tracking-widest text-center select-none">
              [ No games found ]
            </div>
          )}
          
          {import.meta.env.DEV && (
            <a
              href="/search"
              className="w-full text-center block px-4 py-2 bg-[#0c0c0f] hover:bg-white hover:text-black font-mono text-[9px] uppercase tracking-wider text-red-400 font-bold border-t border-white/10 transition-colors"
            >
              Try AI Concept Search →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
