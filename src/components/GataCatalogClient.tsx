"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  LayoutGrid, 
  List, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal, 
  Star, 
  X, 
  Check, 
  Loader2,
  Calendar,
  ExternalLink,
  ShoppingCart,
  CheckCheck
} from "lucide-react";
import { getHighResCoverUrl, getCloudinaryFetchUrl, getCategoryBadge, cleanTitle } from "../lib/utils";
import PlatformLogos from "./PlatformLogos";
import NyanLoader from "./NyanLoader";
import { CartProvider, useCart } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";
import HoverTrailer from "./HoverTrailer";
import { CURATED_HORROR_SCREENSHOTS } from "../data/curatedScreenshots";

import { getCachedCatalogResponse, setCachedCatalogResponse } from "../lib/catalogCache";
import { useCatalogMode } from "../hooks/useCatalogMode";
import { 
  isCatalogCached, 
  syncCatalog, 
  initCatalogWorker, 
  queryLocalCatalog, 
  isLocalWorkerReady 
} from "../lib/catalogStorage";

const formatDate = (dateVal: string | Date | null | undefined) => {
  if (!dateVal) return "TBD";
  try {
    let d: Date;
    if (typeof dateVal === "number" || (/^\d+$/.test(String(dateVal)) && !String(dateVal).includes("-"))) {
      const num = Number(dateVal);
      // If > 100 billion, it's already milliseconds; otherwise unix seconds
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
  releaseDate: string | null;
  trailerUrl?: string | null;
  screenshots: string[];
  tags: Array<{ name: string; slug: string }>;
  purchaseLinks?: Array<{ storeName: string; url: string }>;
  displayRating?: number | null;
  isAbsoluteCinema?: boolean;
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

interface GataCatalogClientProps {
  initialTotalGames: number | null;
  initialGenres: Array<{ name: string; slug: string }>;
  initialTags: Array<{ name: string; slug: string }>;
  initialPlatforms: Array<{ name: string; slug: string }>;
}

const DISCOVERY_HUBS = [
  { 
    id: "trending", 
    name: "Trending", 
    gradient: "from-amber-950/75 via-neutral-900/80 to-black/90 border-amber-950/30 hover:border-amber-600/60", 
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/sciazw.jpg",
    isUpcoming: false,
  },
  { 
    id: "latest", 
    name: "Latest", 
    gradient: "from-indigo-950/75 via-neutral-900/80 to-black/90 border-indigo-950/30 hover:border-indigo-600/60", 
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/scrris.jpg",
    isUpcoming: false,
  },
  { 
    id: "top-rated", 
    name: "Top Rated", 
    gradient: "from-emerald-950/75 via-neutral-900/80 to-black/90 border-emerald-950/30 hover:border-emerald-600/60", 
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/zsco1iaj6riez8rpzphh.jpg",
    isUpcoming: false,
  },
  { 
    id: "upcoming", 
    name: "Upcoming", 
    gradient: "from-red-950/75 via-neutral-900/80 to-black/90 border-red-950/30 hover:border-red-600/60", 
    bgImage: "https://img.itch.zone/aW1hZ2UvMTg2NTI5Mi8xMDk2MzMwNy5wbmc=/original/MwuFZC.png",
    isUpcoming: true,
  },
];

const HORROR_SUBGENRES = [
  { name: "Survival Horror", slug: "survival-horror" },
  { name: "Psychological", slug: "psychological" },
  { name: "Action Horror", slug: "action-horror" },
  { name: "Cosmic & Eldritch", slug: "cosmic-horror" },
  { name: "Folk Horror", slug: "folk-horror" },
  { name: "Body Horror", slug: "body-horror" },
  { name: "Slasher", slug: "slasher" },
  { name: "Supernatural", slug: "supernatural" },
  { name: "Zombie & Apocalypse", slug: "zombie-apocalypse" },
  { name: "Puzzle", slug: "puzzle-horror" },
  { name: "Narrative", slug: "narrative-horror" },
  { name: "Comedy & Parody", slug: "comedy-horror" }
];

const COMMON_FEATURES = [
  { name: "Single-player", slug: "singleplayer" },
  { name: "Multiplayer", slug: "multiplayer" },
  { name: "Co-op", slug: "co-op" },
];

const DECADES = [
  { name: "2020s", slug: "2020s" },
  { name: "2010s", slug: "2010s" },
  { name: "2000s", slug: "2000s" },
  { name: "1990s", slug: "1990s" },
  { name: "Older", slug: "older" },
];


const ORDER_OPTIONS = [
  { label: "Default Order", value: "default" },
  { label: "Price (Low to High)", value: "price-asc" },
  { label: "Price (High to Low)", value: "price-desc" },
  { label: "Title (A to Z)", value: "title" },
];

const formatPrice = (amount: number, currencyCode: string = "USD") => {
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

const getDirectLink = (game: GameData) => {
  const itchLink = game.purchaseLinks?.find(l => l.storeName?.toLowerCase()?.includes("itch"));
  if (itchLink?.url) return itchLink.url;
  const steamLink = game.purchaseLinks?.find(l => l.storeName?.toLowerCase()?.includes("steam"));
  if (steamLink?.url) return steamLink.url;
  if (game.purchaseLinks && game.purchaseLinks.length > 0) return game.purchaseLinks[0].url;
  return null;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("GataCatalogClient Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-500 bg-red-950 p-6 font-mono text-xs text-red-200 space-y-4 rounded-none">
          <h2 className="text-sm font-bold uppercase">Uhh ohh, something crashed</h2>
          <p className="font-bold">Error: {this.state.error?.message}</p>
          <pre className="bg-black/50 p-3 overflow-auto max-h-60 whitespace-pre-wrap text-left">
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="border border-red-500/30 px-3 py-1.5 hover:bg-red-500 hover:text-black font-bold uppercase transition-colors cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface RotatingHubCardProps {
  hub: typeof DISCOVERY_HUBS[0];
  initialScreenshotIndex: number;
  initialDelayMs: number;
  active: boolean;
  onClick: () => void;
}

const RotatingHubCard: React.FC<RotatingHubCardProps> = ({
  hub,
  initialScreenshotIndex,
  initialDelayMs,
  active,
  onClick,
}) => {
  const formatScreenshot = (url: string) => {
    if (!url) return "";
    return url.replace("t_screenshot_huge", "t_screenshot_med");
  };

  const [slides] = useState<string[]>(() => {
    if (!CURATED_HORROR_SCREENSHOTS || CURATED_HORROR_SCREENSHOTS.length === 0) {
      return [formatScreenshot(hub.bgImage)];
    }
    const pool: string[] = [];
    const len = CURATED_HORROR_SCREENSHOTS.length;
    for (let i = 0; i < 8; i++) {
      const idx = (initialScreenshotIndex + i * 13) % len;
      pool.push(formatScreenshot(CURATED_HORROR_SCREENSHOTS[idx]?.url || hub.bgImage));
    }
    return pool;
  });

  const [activeUrl, setActiveUrl] = useState(() => slides[0]);
  const [incomingUrl, setIncomingUrl] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (slides.length <= 1) return;
    let timer: ReturnType<typeof setTimeout>;
    let stepTimer: ReturnType<typeof setTimeout>;
    let completeTimer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      // Independent un-synced random interval: between 5000ms and 8500ms
      const delay = 5000 + Math.floor(Math.random() * 3500);
      timer = setTimeout(() => {
        const nextUrl = slides[Math.floor(Math.random() * slides.length)] || slides[0];
        setIncomingUrl(nextUrl);
        setFadeIn(false);

        stepTimer = setTimeout(() => {
          setFadeIn(true);
        }, 40);

        completeTimer = setTimeout(() => {
          setActiveUrl(nextUrl);
          setIncomingUrl(null);
          setFadeIn(false);
        }, 1100);

        scheduleNext();
      }, delay);
    };

    // Staggered initial delay so each card fades at a completely different time
    const initialTimer = setTimeout(scheduleNext, initialDelayMs);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(timer);
      clearTimeout(stepTimer);
      clearTimeout(completeTimer);
    };
  }, [slides, initialDelayMs]);

  return (
    <button
      onClick={onClick}
      className={`w-full snap-start border p-3 sm:p-4 text-center flex flex-col justify-center items-center transition-all duration-300 relative group min-h-[90px] sm:min-h-[105px] cursor-pointer bg-gradient-to-br ${hub.gradient} overflow-hidden rounded-2xl
        ${active 
          ? "shadow-[0_0_25px_rgba(255,255,255,0.15)] scale-[1.02] border-white! text-white ring-1 ring-white/30" 
          : "border-white/10 text-white/70 hover:text-white hover:border-white/30"
        }`}
    >
      {/* Ken Burns Background Slides: Lean 2-Layer DOM prevents 40 simultaneous 1080p decoded bitmaps (saves ~320MB GPU RAM) */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden select-none">
        {/* Base Active Slide */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center filter brightness-[0.70] contrast-[1.10] transform scale-104 transition-transform duration-[8000ms] ease-out"
          style={{ backgroundImage: `url(${activeUrl})` }}
        />

        {/* Cross-Fading Incoming Slide */}
        {incomingUrl && (
          <div
            className={`absolute inset-0 w-full h-full bg-cover bg-center filter brightness-[0.70] contrast-[1.10] transition-opacity duration-1000 ease-in-out transform transition-transform duration-[8000ms] ease-out ${
              fadeIn ? "opacity-100 scale-106" : "opacity-0 scale-100"
            }`}
            style={{ backgroundImage: `url(${incomingUrl})` }}
          />
        )}

        {/* Atmospheric Vignette: Boosted visibility with safe text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/50 group-hover:from-black/50 group-hover:via-black/10 group-hover:to-black/40 transition-colors" />
      </div>

      {/* Super-Wide Centered Sans-Serif Text */}
      <div className="relative z-10 flex items-center justify-center w-full px-1 sm:px-2">
        <h4 className="font-sans font-black uppercase text-sm sm:text-base md:text-lg lg:text-base xl:text-lg tracking-[0.25em] sm:tracking-[0.3em] text-white text-center w-full drop-shadow-[0_2px_12px_rgba(0,0,0,1)] drop-shadow-[0_0_16px_rgba(0,0,0,0.85)] leading-tight select-none flex items-center justify-center gap-1.5">
          <span>{hub.name}</span>
          {hub.isUpcoming && (
            <span className="text-white/40 group-hover:text-white transition-all text-xs sm:text-sm group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              ↗
            </span>
          )}
        </h4>
      </div>

      {/* Active Crimson Bottom Indicator Bar */}
      {active && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-red-600 rounded-full shadow-[0_0_10px_#dc2626] z-20" />
      )}
    </button>
  );
};

export default function GataCatalogClient(props: GataCatalogClientProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <ErrorBoundary>
          <GataCatalogClientInner {...props} />
        </ErrorBoundary>
      </CartProvider>
    </AuthProvider>
  );
}

function GataCatalogClientInner({
  initialTotalGames,
  initialGenres = [],
  initialTags = [],
  initialPlatforms = []
}: GataCatalogClientProps) {
  const { addToCart, cartItems } = useCart();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [games, setGames] = useState<GameData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [dbMaxPrice, setDbMaxPrice] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFeed, setActiveFeed] = useState<"trending" | "latest" | "top-rated">("trending");
  const [sortBy, setSortBy] = useState("trending");
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [hideDlcs, setHideDlcs] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [priceSlider, setPriceSlider] = useState(60);
  const [debouncedPriceSlider, setDebouncedPriceSlider] = useState(60);
  
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Mobile Filter Drawer Toggle
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const activeFilterCount = 
    selectedFeatures.length + 
    selectedSystems.length + 
    selectedDecades.length + 
    (hideDlcs ? 0 : 1) + 
    (freeOnly ? 1 : 0) + 
    (minPrice || maxPrice ? 1 : 0);

  // Correction Suggestion
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [originalSearch, setOriginalSearch] = useState<string>("");
  const bypassCorrectionRef = useRef<string | null>(null);

  // UI Accordion Toggles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    price: true,
    genres: true,
    systems: true,
    features: true,
    decades: true
  });

  // Hover Card Popover State
  const [hoveredGame, setHoveredGame] = useState<GameData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number; side: "left" | "right" }>({ x: 0, y: 0, side: "right" });
  const [activeScreenshotIdx, setActiveScreenshotIdx] = useState(0);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const gamesPerPage = 24;

  // Local vs Cloud Catalog Mode
  const { mode: catalogMode, setMode: setCatalogMode } = useCatalogMode();
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isLocalReady, setIsLocalReady] = useState<boolean>(false);

  // Auto-initialize local worker (auto-downloads on first visit)
  useEffect(() => {
    isCatalogCached().then(async (cached) => {
      if (cached.cached) {
        const ready = await initCatalogWorker();
        if (ready) setIsLocalReady(true);
      } else {
        setDownloadProgress(0);
        const ready = await initCatalogWorker((pct) => {
          setDownloadProgress(pct);
        });
        setDownloadProgress(null);
        if (ready) setIsLocalReady(true);
      }
    });
  }, []);

  // Keyboard shortcut listener (⌘K / Ctrl+K / / to focus search input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA")
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Hydrate from URL query parameters on mount & popstate
  useEffect(() => {
    const hydrateFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setSearchQuery(params.get("search") || "");
      const urlSort = params.get("sort") || "trending";
      if (urlSort === "upcoming") {
        window.location.replace("/upcoming");
        return;
      }
      setSortBy(urlSort);
      if (urlSort === "latest" || urlSort === "top-rated" || urlSort === "trending") {
        setActiveFeed(urlSort);
      }
      setHideDlcs(params.get("hideDlcs") !== "false");
      setFreeOnly(params.get("freeOnly") === "true");
      setMinPrice(params.get("minPrice") || "");
      const urlMaxPrice = params.get("maxPrice");
      if (urlMaxPrice) {
        setMaxPrice(urlMaxPrice);
        const parsed = parseInt(urlMaxPrice, 10);
        if (!isNaN(parsed)) {
          setPriceSlider(parsed);
          setDebouncedPriceSlider(parsed);
        }
      } else {
        setMaxPrice("");
      }
      
      const pageVal = parseInt(params.get("page") || "1", 10);
      setCurrentPage(isNaN(pageVal) ? 1 : pageVal);

      const genresVal = params.get("genres");
      setSelectedGenres(genresVal ? genresVal.split(",").filter(Boolean) : []);

      const systemsVal = params.get("systems");
      setSelectedSystems(systemsVal ? systemsVal.split(",").filter(Boolean) : []);

      const decadesVal = params.get("decades");
      setSelectedDecades(decadesVal ? decadesVal.split(",").filter(Boolean) : []);

      const featuresVal = params.get("features");
      setSelectedFeatures(featuresVal ? featuresVal.split(",").filter(Boolean) : []);
    };

    if (typeof window !== "undefined") {
      hydrateFromUrl();
      window.addEventListener("popstate", hydrateFromUrl);
      
      const savedLayout = localStorage.getItem("gata-layout-mode");
      if (savedLayout === "list" || savedLayout === "grid") {
        setLayoutMode(savedLayout);
      }

      return () => window.removeEventListener("popstate", hydrateFromUrl);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // When search changes, reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    setCorrectedQuery(null);
  }, [debouncedSearch]);

  // Debounce price slider input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPriceSlider(priceSlider);
    }, 300);
    return () => clearTimeout(handler);
  }, [priceSlider]);

  // When debounced price slider changes, reset to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedPriceSlider]);

  // Sync state to URL and Fetch Games
  useEffect(() => {
    const controller = new AbortController();

    const fetchGames = async () => {
      setLoading(true);
      try {
        const finalMaxPrice = maxPrice || (debouncedPriceSlider < dbMaxPrice ? debouncedPriceSlider.toString() : "");

        // Cloud DB Query (Compulsory for full catalog search, sorting, and filtering)
        const queryParams = new URLSearchParams();
        if (debouncedSearch.trim()) queryParams.set("search", debouncedSearch);
        if (sortBy) queryParams.set("sort", sortBy);
        if (!hideDlcs) queryParams.set("hideDlcs", "false");
        if (freeOnly) queryParams.set("freeOnly", "true");
        if (minPrice) queryParams.set("minPrice", minPrice);
        if (finalMaxPrice) queryParams.set("maxPrice", finalMaxPrice);

        if (selectedGenres.length > 0) queryParams.set("genres", selectedGenres.join(","));
        if (selectedSystems.length > 0) queryParams.set("systems", selectedSystems.join(","));
        if (selectedDecades.length > 0) queryParams.set("decades", selectedDecades.join(","));
        if (selectedFeatures.length > 0) queryParams.set("features", selectedFeatures.join(","));

        // Pagination
        const limitVal = gamesPerPage;
        const offset = (currentPage - 1) * gamesPerPage;
        queryParams.set("offset", offset.toString());
        queryParams.set("limit", limitVal.toString());

        // Update URL bar
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(queryParams);
          urlParams.set("page", currentPage.toString());
          if (hideDlcs) urlParams.set("hideDlcs", "true");
          const urlQuery = urlParams.toString();
          const targetUrl = urlQuery ? `/games?${urlQuery}` : "/games";
          if (window.location.search !== `?${urlQuery}`) {
            window.history.replaceState(null, "", targetUrl);
          }
        }

        // Check if Local Mode is active (Default & Primary Search Engine)
        if (catalogMode === "local") {
          try {
            const finalMaxPriceNum = finalMaxPrice ? parseFloat(finalMaxPrice) : undefined;
            const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
            const isBypassed = bypassCorrectionRef.current === debouncedSearch.trim();
            const localRes = await queryLocalCatalog({
              search: debouncedSearch.trim() || undefined,
              sort: sortBy,
              hideDlcs,
              freeOnly,
              minPrice: minPriceNum,
              maxPrice: finalMaxPriceNum,
              genres: selectedGenres.length > 0 ? selectedGenres : undefined,
              systems: selectedSystems.length > 0 ? selectedSystems : undefined,
              decades: selectedDecades.length > 0 ? selectedDecades : undefined,
              features: selectedFeatures.length > 0 ? selectedFeatures : undefined,
              offset: (currentPage - 1) * gamesPerPage,
              limit: gamesPerPage,
              skipCorrection: isBypassed,
            }, (pct) => setDownloadProgress(pct));

            if (localRes && !controller.signal.aborted) {
              setGames(localRes.games || []);
              setTotalCount(localRes.totalCount || 0);
              if (localRes.correctedQuery) {
                setCorrectedQuery(localRes.correctedQuery);
                setOriginalSearch(debouncedSearch);
              } else {
                setCorrectedQuery(null);
              }
              setDownloadProgress(null);
              setLoading(false);
              return;
            }
          } catch (localErr) {
            console.warn("Local catalog query failed, falling back to Cloud:", localErr);
          }
        }

        const cacheKey = queryParams.toString();
        const cachedData = getCachedCatalogResponse(cacheKey);
        if (cachedData && !controller.signal.aborted) {
          setGames(cachedData.games || []);
          setTotalCount(cachedData.totalCount || 0);
          if (cachedData.maxPrice && cachedData.maxPrice > 0) {
            setDbMaxPrice(cachedData.maxPrice);
            if (priceSlider === 60) setPriceSlider(cachedData.maxPrice);
          }
          if (cachedData.correctedQuery) {
            setCorrectedQuery(cachedData.correctedQuery);
            setOriginalSearch(debouncedSearch);
          } else {
            setCorrectedQuery(null);
          }
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/games?${queryParams.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) {
            setGames(data.games || []);
            setTotalCount(data.totalCount || 0);
            if (data.maxPrice && data.maxPrice > 0) {
              setDbMaxPrice(data.maxPrice);
              if (priceSlider === 60) setPriceSlider(data.maxPrice);
            }

            if (data.correctedQuery) {
              setCorrectedQuery(data.correctedQuery);
              setOriginalSearch(debouncedSearch);
            } else {
              setCorrectedQuery(null);
            }

            // Write to client cache
            setCachedCatalogResponse(cacheKey, data);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Failed to query catalog:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchGames();

    return () => {
      controller.abort();
    };
  }, [
    debouncedSearch,
    currentPage,
    sortBy,
    hideDlcs,
    freeOnly,
    minPrice,
    maxPrice,
    debouncedPriceSlider,
    selectedGenres,
    selectedSystems,
    selectedDecades,
    selectedFeatures,
    catalogMode,
    isLocalReady
  ]);

  // Discovery hubs click handlers
  const handleHubClick = (hub: typeof DISCOVERY_HUBS[0]) => {
    if (hub.isUpcoming) {
      window.location.assign("/upcoming");
      return;
    }
    setActiveFeed(hub.id as "trending" | "latest" | "top-rated");
    setSortBy(hub.id);
    setCurrentPage(1);
  };

  const isHubActive = (hub: typeof DISCOVERY_HUBS[0]) => {
    if (hub.isUpcoming) return false;
    const isOrderActive = ["price-asc", "price-desc", "title"].includes(sortBy);
    return activeFeed === hub.id && !isOrderActive;
  };

  // Checkbox toggle handlers
  const toggleGenre = (slug: string) => {
    setCurrentPage(1);
    setSelectedGenres(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const toggleSystem = (slug: string) => {
    setCurrentPage(1);
    setSelectedSystems(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const toggleDecade = (slug: string) => {
    setCurrentPage(1);
    setSelectedDecades(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const toggleFeature = (slug: string) => {
    setCurrentPage(1);
    setSelectedFeatures(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setCurrentPage(1);
    setActiveFeed("trending");
    setSortBy("trending");
    setHideDlcs(true);
    setFreeOnly(false);
    setMinPrice("");
    setMaxPrice("");
    setPriceSlider(dbMaxPrice);
    setSelectedGenres([]);
    setSelectedSystems([]);
    setSelectedDecades([]);
    setSelectedFeatures([]);
    setCorrectedQuery(null);
  };

  const totalPages = Math.ceil(totalCount / gamesPerPage) || 1;

  // Layout preference sync
  const changeLayoutMode = (mode: "grid" | "list") => {
    setLayoutMode(mode);
    localStorage.setItem("gata-layout-mode", mode);
  };

  // Hover popover events
  const handleCardMouseEnter = (e: React.MouseEvent, game: GameData) => {
    if (window.innerWidth < 1024) return; // Disable hover cards on mobile/tablets
    const rect = e.currentTarget.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const side = screenWidth - rect.right < 360 ? "left" : "right";
    
    setHoveredGame(game);
    setHoverPosition({
      x: side === "right" ? rect.right + window.scrollX + 12 : rect.left + window.scrollX - 352,
      y: rect.top + window.scrollY - 10,
      side
    });
    setActiveScreenshotIdx(0);

    // Auto rotate screenshots in popover
    if (screenshotIntervalRef.current) clearInterval(screenshotIntervalRef.current);
    if (game.screenshots && game.screenshots.length > 1) {
      screenshotIntervalRef.current = setInterval(() => {
        setActiveScreenshotIdx(prev => (prev + 1) % Math.min(game.screenshots.length, 4));
      }, 2200);
    }
  };

  const handleCardMouseLeave = () => {
    setHoveredGame(null);
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
      screenshotIntervalRef.current = null;
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const cheapestPriceSnapshot = (game: GameData) => {
    if (!game.priceSnapshots || game.priceSnapshots.length === 0) return null;
    return [...game.priceSnapshots].sort((a, b) => a.dealPrice - b.dealPrice)[0];
  };

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderRatingBadge = (game: GameData) => {
    if (game.displayRating === undefined || game.displayRating === null) return null;
    
    const score = game.displayRating;
    let borderColor = "border-neutral-700 text-neutral-400";
    let badgeText = "";
    
    if (score >= 90) {
      borderColor = "border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]";
      badgeText = "ABSOLUTE CINEMA";
    } else if (score >= 75) {
      borderColor = "border-blue-500 text-blue-400";
    } else if (score >= 50) {
      borderColor = "border-amber-500 text-amber-400";
    } else {
      borderColor = "border-red-500 text-red-400";
    }

    return (
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1 select-none pointer-events-none">
        <div className={`w-9 h-9 rounded-full bg-black/85 backdrop-blur-sm border-2 ${borderColor} flex items-center justify-center font-mono text-[11px] font-black uppercase`}>
          {Math.round(score)}
        </div>
        {badgeText && (
          <span className="font-mono text-[7px] tracking-widest bg-emerald-600/90 text-white font-black px-1.5 py-0.5 uppercase border border-emerald-400/30">
            {badgeText}
          </span>
        )}
      </div>
    );
  };

  // Render pagination buttons
  const renderPaginationNumbers = () => {
    const numbers = [];
    const delta = 2; // numbers to show before/after current page
    
    let start = Math.max(1, currentPage - delta);
    let end = Math.min(totalPages, currentPage + delta);

    if (start > 1) {
      numbers.push(
        <button
          key={1}
          onClick={() => changePage(1)}
          className={`w-9 h-9 border font-mono text-xs uppercase font-bold flex items-center justify-center transition-colors
            ${currentPage === 1 
              ? "bg-white border-white text-black" 
              : "border-white/10 text-white/60 hover:text-white hover:border-white"}`}
        >
          1
        </button>
      );
      if (start > 2) {
        numbers.push(<span key="ellipsis-start" className="text-white/30 font-mono self-end px-1 leading-8">...</span>);
      }
    }

    for (let i = start; i <= end; i++) {
      numbers.push(
        <button
          key={i}
          onClick={() => changePage(i)}
          className={`w-9 h-9 border font-mono text-xs uppercase font-bold flex items-center justify-center transition-colors
            ${currentPage === i 
              ? "bg-white border-white text-black" 
              : "border-white/10 text-white/60 hover:text-white hover:border-white"}`}
        >
          {i}
        </button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        numbers.push(<span key="ellipsis-end" className="text-white/30 font-mono self-end px-1 leading-8">...</span>);
      }
      numbers.push(
        <button
          key={totalPages}
          onClick={() => changePage(totalPages)}
          className={`w-9 h-9 border font-mono text-xs uppercase font-bold flex items-center justify-center transition-colors
            ${currentPage === totalPages 
              ? "bg-white border-white text-black" 
              : "border-white/10 text-white/60 hover:text-white hover:border-white"}`}
        >
          {totalPages}
        </button>
      );
    }

    return numbers;
  };

  return (
    <div className="space-y-8 select-none">
      {/* ── Primary Discovery Hubs (Trending, Latest, Top Rated, Upcoming) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 select-none">
        {DISCOVERY_HUBS.map((hub, i) => {
          const delays = [1000, 3200, 2100, 4500];
          return (
            <RotatingHubCard
              key={hub.id}
              hub={hub}
              initialScreenshotIndex={i * 22}
              initialDelayMs={delays[i % delays.length]}
              active={isHubActive(hub)}
              onClick={() => handleHubClick(hub)}
            />
          );
        })}
      </div>

      {/* Mobile Filter Toggle Button */}
      <div className="lg:hidden w-full mb-4">
        <button
          onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
          className="w-full flex items-center justify-between bg-[#121217] border border-white/15 px-4 py-3 rounded-xl font-sans text-xs text-white font-semibold hover:bg-[#181820] transition-all cursor-pointer shadow-lg"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-white/80" />
            <span>Filters & Refinements</span>
            {activeFilterCount > 0 && (
              <span className="bg-white text-black text-[10px] px-2 py-0.5 rounded-full font-bold">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-white/60 transition-transform duration-200 ${isMobileFilterOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── Main Catalog Frame ── */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* ── Left Sidebar Filters (Modern Sans UI) ── */}
        <aside className={`${isMobileFilterOpen ? "block" : "hidden"} lg:block w-full lg:w-64 shrink-0 space-y-5 bg-[#121217]/95 border border-white/12 p-5 rounded-2xl shadow-xl backdrop-blur-md`}>
          {/* Sidebar Header */}
          <div className="flex justify-between items-center pb-3.5 border-b border-white/10">
            <span className="font-sans text-xs text-white uppercase font-bold tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-white/70" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white/10 border border-white/15 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </span>
            {activeFilterCount > 0 && (
              <button 
                onClick={clearAllFilters}
                className="font-sans text-[11px] font-semibold text-white/50 hover:text-white px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-4 font-sans text-xs">
            {/* Quick Toggle Checkboxes: DLC / Free */}
            <div className="space-y-2.5 pb-3 border-b border-white/10">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none text-white/70 hover:text-white transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  hideDlcs 
                    ? "bg-white border-white text-black" 
                    : "bg-white/5 border-white/20 group-hover:border-white/40"
                }`}>
                  {hideDlcs && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <input
                  type="checkbox"
                  checked={hideDlcs}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setHideDlcs(e.target.checked);
                  }}
                  className="sr-only"
                />
                <span className="font-sans text-xs font-medium">Hide DLCs & Extras</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer group select-none text-white/70 hover:text-white transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  freeOnly 
                    ? "bg-white border-white text-black" 
                    : "bg-white/5 border-white/20 group-hover:border-white/40"
                }`}>
                  {freeOnly && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setFreeOnly(e.target.checked);
                  }}
                  className="sr-only"
                />
                <span className="font-sans text-xs font-medium">Show Only Free Games</span>
              </label>
            </div>

            {/* Price Accordion */}
            <div className="border-b border-white/10 pb-3.5">
              <button 
                onClick={() => toggleSection("price")}
                className="flex justify-between items-center w-full font-sans font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors py-1 text-xs"
              >
                <span>Price Range</span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openSections.price ? "rotate-180" : ""}`} />
              </button>
              {openSections.price && (
                <div className="space-y-3 mt-3 animate-fade-in">
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => {
                        setCurrentPage(1);
                        setMinPrice(e.target.value);
                      }}
                      placeholder="Min ($)"
                      className="w-1/2 bg-[#181820] border border-white/10 px-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans text-center text-white placeholder:text-white/30"
                    />
                    <span className="text-white/30">—</span>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => {
                        setCurrentPage(1);
                        setMaxPrice(e.target.value);
                      }}
                      placeholder="Max ($)"
                      className="w-1/2 bg-[#181820] border border-white/10 px-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans text-center text-white placeholder:text-white/30"
                    />
                  </div>
                  {!freeOnly && !maxPrice && (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="range"
                        min="0"
                        max={dbMaxPrice}
                        step="1"
                        value={priceSlider}
                        onChange={(e) => {
                          setCurrentPage(1);
                          setPriceSlider(parseInt(e.target.value, 10));
                        }}
                        className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[11px] font-sans text-white/40">
                        <span>Free</span>
                        <span className="text-white font-semibold">Max: {formatPrice(priceSlider)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Genres Accordion (Curated Horror Sub-genres) */}
            <div className="border-b border-white/10 pb-3.5">
              <button 
                onClick={() => toggleSection("genres")}
                className="flex justify-between items-center w-full font-sans font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors py-1 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  Genres
                  {HORROR_SUBGENRES.filter(sub => selectedFeatures.includes(sub.slug)).length > 0 && (
                    <span className="text-[10px] text-white/40 font-normal">
                      ({HORROR_SUBGENRES.filter(sub => selectedFeatures.includes(sub.slug)).length})
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openSections.genres ? "rotate-180" : ""}`} />
              </button>
              {openSections.genres && (
                <div className="space-y-2 mt-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar animate-fade-in">
                  {HORROR_SUBGENRES.map((sub) => {
                    const isChecked = selectedFeatures.includes(sub.slug);
                    return (
                      <label key={sub.slug} className="flex items-center gap-2.5 cursor-pointer group select-none text-white/70 hover:text-white transition-colors">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked 
                            ? "bg-white border-white text-black" 
                            : "bg-white/5 border-white/20 group-hover:border-white/40"
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFeature(sub.slug)}
                          className="sr-only"
                        />
                        <span className="font-sans text-xs font-medium">{sub.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Systems Accordion */}
            <div className="border-b border-white/10 pb-3.5">
              <button 
                onClick={() => toggleSection("systems")}
                className="flex justify-between items-center w-full font-sans font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors py-1 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  Operating Systems
                  {selectedSystems.length > 0 && (
                    <span className="text-[10px] text-white/40 font-normal">({selectedSystems.length})</span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openSections.systems ? "rotate-180" : ""}`} />
              </button>
              {openSections.systems && (
                <div className="space-y-2 mt-3 animate-fade-in">
                  {["win", "mac", "linux"].map((sys) => {
                    const label = sys === "win" ? "Windows" : sys === "mac" ? "macOS" : "Linux";
                    const isChecked = selectedSystems.includes(sys);
                    return (
                      <label key={sys} className="flex items-center gap-2.5 cursor-pointer group select-none text-white/70 hover:text-white transition-colors">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked 
                            ? "bg-white border-white text-black" 
                            : "bg-white/5 border-white/20 group-hover:border-white/40"
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSystem(sys)}
                          className="sr-only"
                        />
                        <span className="font-sans text-xs font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Features Accordion */}
            <div className="border-b border-white/10 pb-3.5">
              <button 
                onClick={() => toggleSection("features")}
                className="flex justify-between items-center w-full font-sans font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors py-1 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  Features
                  {COMMON_FEATURES.filter(f => selectedFeatures.includes(f.slug)).length > 0 && (
                    <span className="text-[10px] text-white/40 font-normal">
                      ({COMMON_FEATURES.filter(f => selectedFeatures.includes(f.slug)).length})
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openSections.features ? "rotate-180" : ""}`} />
              </button>
              {openSections.features && (
                <div className="space-y-2 mt-3 animate-fade-in">
                  {COMMON_FEATURES.map((feature) => {
                    const isChecked = selectedFeatures.includes(feature.slug);
                    return (
                      <label key={feature.slug} className="flex items-center gap-2.5 cursor-pointer group select-none text-white/70 hover:text-white transition-colors">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked 
                            ? "bg-white border-white text-black" 
                            : "bg-white/5 border-white/20 group-hover:border-white/40"
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFeature(feature.slug)}
                          className="sr-only"
                        />
                        <span className="font-sans text-xs font-medium">{feature.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Decades Accordion */}
            <div className="pt-0.5">
              <button 
                onClick={() => toggleSection("decades")}
                className="flex justify-between items-center w-full font-sans font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors py-1 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  Release Date
                  {selectedDecades.length > 0 && (
                    <span className="text-[10px] text-white/40 font-normal">({selectedDecades.length})</span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${openSections.decades ? "rotate-180" : ""}`} />
              </button>
              {openSections.decades && (
                <div className="space-y-2 mt-3 animate-fade-in">
                  {DECADES.map((dec) => {
                    const isChecked = selectedDecades.includes(dec.slug);
                    return (
                      <label key={dec.slug} className="flex items-center gap-2.5 cursor-pointer group select-none text-white/70 hover:text-white transition-colors">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked 
                            ? "bg-white border-white text-black" 
                            : "bg-white/5 border-white/20 group-hover:border-white/40"
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDecade(dec.slug)}
                          className="sr-only"
                        />
                        <span className="font-sans text-xs font-medium">{dec.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </aside>

        {/* ── Right Content Area ── */}
        <div className="flex-grow w-full space-y-6">
          
          {/* ── Seamless Full-Spanning AI Glow Pill Search Bar ── */}
          <div className="relative w-full">
            <style>{`
              @keyframes seamlessAiGlow {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>

            {/* Outer Pill Wrapper with Full-Spanning Shimmer Border */}
            <div className="relative p-[1.5px] rounded-full overflow-hidden group shadow-[0_4px_25px_rgba(0,0,0,0.5)] transition-all duration-300">
              
              {/* Base subtle white border */}
              <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40 group-focus-within:border-white/60 transition-colors pointer-events-none z-10" />

              {/* Full-Spanning Seamless Sweeping White AI Light Beam */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300"
                style={{
                  background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0.05) 100%)",
                  backgroundSize: "200% 100%",
                  animation: "seamlessAiGlow 3.5s linear infinite",
                }}
              />

              {/* Ambient White Halo behind the pill */}
              <div className="absolute inset-0 rounded-full bg-white/5 blur-xs group-hover:bg-white/15 group-focus-within:bg-white/20 transition-all duration-300 pointer-events-none" />

              {/* Pill Input Container */}
              <div className="relative flex items-center w-full bg-[#121216] rounded-full z-20">
                <div className="absolute left-4.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150 z-10">
                  <Search className="w-4 h-4 text-white/40 group-focus-within:text-white transition-colors duration-200" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    bypassCorrectionRef.current = null;
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="Search games by title, developer, genre, or keyword..."
                  className="w-full h-12 pl-11 pr-24 bg-[#121216] hover:bg-[#16161c] text-xs sm:text-sm text-white placeholder:text-white/40 rounded-full focus:outline-none focus:bg-[#181820] transition-all duration-200 font-sans tracking-wide"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                  {searchQuery ? (
                    <button 
                      onClick={() => {
                        bypassCorrectionRef.current = null;
                        setSearchQuery("");
                      }}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2.5 py-1 text-[10px] font-mono font-medium bg-white/10 text-white/50 border border-white/15 rounded-full select-none">
                      <span className="text-[9px]">⌘</span>K
                    </kbd>
                  )}
                </div>
              </div>
            </div>

            {debouncedSearch.trim() && (
              <div className="mt-2.5 px-4 flex items-center justify-between font-sans text-xs text-white/50 select-none">
                <span>
                  {loading ? (
                    <span className="animate-pulse">Searching games database...</span>
                  ) : (
                    <span>Found <strong className="text-white font-semibold">{totalCount.toLocaleString()}</strong> results for "<span className="text-white italic">{debouncedSearch}</span>"</span>
                  )}
                </span>
                <button 
                  onClick={() => {
                    bypassCorrectionRef.current = null;
                    setSearchQuery("");
                  }} 
                  className="text-white/40 hover:text-white transition-colors cursor-pointer text-xs underline font-medium"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Spelling auto-correction banner */}
          {correctedQuery && (
            <div className="border border-white/10 bg-white/[0.02] px-4 py-3 text-xs flex items-center justify-between gap-3 text-neutral-300">
              <span className="text-neutral-300">
                Showing results for <strong className="text-white font-medium underline underline-offset-2">{correctedQuery}</strong>.
                <span className="text-neutral-500 ml-1.5 font-normal">Search for "{originalSearch}" instead.</span>
              </span>
              <button 
                type="button"
                onClick={() => {
                  bypassCorrectionRef.current = originalSearch.trim();
                  setSearchQuery(originalSearch);
                  setCorrectedQuery(null);
                }}
                className="text-[11px] text-neutral-300 hover:text-white border border-white/15 hover:border-white/40 px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0"
              >
                Search "{originalSearch}"
              </button>
            </div>
          )}

          {/* Header titles & counts */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                {(() => {
                  const parts: string[] = [];
                  if (selectedSystems.length === 1) {
                    const sys = selectedSystems[0];
                    parts.push(sys === "win" ? "PC" : sys === "mac" ? "macOS" : "Linux");
                  } else if (selectedSystems.length > 1) {
                    parts.push("Multi-Platform");
                  }
                  if (selectedGenres.length === 1) {
                    const g = HORROR_SUBGENRES.find((sg) => sg.slug === selectedGenres[0]) ||
                              initialGenres.find((ig) => ig.slug === selectedGenres[0]);
                    if (g) parts.push(g.name);
                  } else if (selectedGenres.length > 1) {
                    parts.push("Selected Genres");
                  }
                  if (selectedDecades.length === 1) {
                    const d = DECADES.find((dec) => dec.slug === selectedDecades[0]);
                    if (d) parts.push(d.name);
                  }
                  if (parts.length === 0) return "All Games";
                  return `${parts.join(" · ")} Games`;
                })()}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 font-mono text-[11px]">
                <span className="text-white/90 font-bold tracking-wider uppercase">
                  Showing {totalCount.toLocaleString()} {totalCount === 1 ? "game" : "games"}
                </span>
                {initialTotalGames && totalCount !== initialTotalGames && (
                  <span className="text-white/40 tracking-wider">
                    (of {initialTotalGames.toLocaleString()} in catalog)
                  </span>
                )}
              </div>
            </div>

            {/* Top Pagination controls inside header row */}
            {sortBy !== "title" && (
              <div className="flex items-center gap-3 self-end sm:self-auto select-none">
                <span className="font-mono text-[11px] text-white/50">
                  Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
                </span>
                <div className="flex border border-white/10">
                  <button
                    disabled={currentPage === 1 || loading}
                    onClick={() => changePage(1)}
                    className="px-2.5 py-1.5 border-r border-white/10 text-white hover:bg-neutral-900 disabled:text-white/20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={currentPage === 1 || loading}
                    onClick={() => changePage(Math.max(1, currentPage - 1))}
                    className="px-2.5 py-1.5 border-r border-white/10 text-white hover:bg-neutral-900 disabled:text-white/20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={currentPage === totalPages || loading}
                    onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
                    className="px-2.5 py-1.5 border-r border-white/10 text-white hover:bg-neutral-900 disabled:text-white/20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={currentPage === totalPages || loading}
                    onClick={() => changePage(totalPages)}
                    className="px-2.5 py-1.5 text-white hover:bg-neutral-900 disabled:text-white/20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Sort & Layout Controls Bar ── */}
          <div className="flex items-center justify-between bg-[#121217]/95 border border-white/12 p-3 sm:p-4 rounded-2xl flex-wrap gap-3 backdrop-blur-md shadow-xl">
            {/* Left: Sort by Order Selector */}
            <div className="flex items-center gap-3">
              <span className="font-sans text-xs text-white/50 font-semibold tracking-wide">
                Sort by:
              </span>
              <select
                value={["price-asc", "price-desc", "title"].includes(sortBy) ? sortBy : "default"}
                onChange={(e) => {
                  setCurrentPage(1);
                  const val = e.target.value;
                  if (val === "default") {
                    setSortBy(activeFeed);
                  } else {
                    setSortBy(val);
                  }
                }}
                className="bg-[#181820] border border-white/15 px-3.5 py-2 text-xs text-white font-sans rounded-xl focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 font-bold cursor-pointer transition-all shadow-sm"
              >
                {ORDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#121217] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Right: Layout Mode Toggles */}
            <div className="flex bg-[#181820] border border-white/12 rounded-xl p-1 gap-1">
              <button
                onClick={() => changeLayoutMode("grid")}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  layoutMode === "grid" 
                    ? "bg-white text-black font-bold shadow-md" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                title="Grid layout"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeLayoutMode("list")}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  layoutMode === "list" 
                    ? "bg-white text-black font-bold shadow-md" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                title="List layout"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar during initial download */}
          {downloadProgress !== null && (
            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden -mt-1">
              <div
                className="bg-white/40 h-full transition-all duration-300 rounded-full"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}

          {/* ── Game List Layouts ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 min-h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
              <span className="font-mono text-xs uppercase tracking-widest text-white/40 font-bold animate-pulse">
                {downloadProgress !== null
                  ? `Loading games (${downloadProgress}%)...`
                  : "Loading games..."}
              </span>
            </div>
          ) : games.length === 0 ? (
            <div className="border border-white/10 text-center py-20 min-h-[260px] flex flex-col justify-center items-center gap-3">
              <span className="font-mono text-xs text-white/50 uppercase font-bold tracking-widest">No games found</span>
              {correctedQuery ? (
                <div className="text-xs sm:text-sm text-neutral-300 flex items-center justify-center gap-1.5 font-sans">
                  <span>Did you mean:</span>
                  <button
                    type="button"
                    onClick={() => {
                      bypassCorrectionRef.current = null;
                      setSearchQuery(correctedQuery);
                      setCorrectedQuery(null);
                    }}
                    className="text-white underline underline-offset-4 hover:text-neutral-200 font-medium cursor-pointer transition-colors"
                  >
                    "{correctedQuery}"
                  </button>
                  <span>?</span>
                </div>
              ) : (
                <p className="font-mono text-[10px] text-white/30 max-w-sm leading-relaxed uppercase">
                  Modify your active filters or clear search query.
                </p>
              )}
            </div>
          ) : (
            <div className="relative">
              {layoutMode === "grid" ? (
                /* Grid view cards */
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 items-stretch">
                  {(() => {
                    let lastLetter = "";
                    return games.map((game, idx) => {
                      const finalDeal = cheapestPriceSnapshot(game);
                    const itchLink = game.purchaseLinks?.find(l => l.storeName?.toLowerCase()?.includes("itch"))?.url;
                    const directLink = getDirectLink(game);
                    const badge = getCategoryBadge(game.category, game.title);
                    
                      // Calculate current letter for breaks
                      const title = cleanTitle(game.title || "");
                      let currentLetter = title.trim().charAt(0).toUpperCase();
                      if (!currentLetter || !/[A-Z]/.test(currentLetter)) {
                        currentLetter = "#";
                      }

                      const showHeader = sortBy === "title" && currentLetter !== lastLetter;
                      if (showHeader) {
                        lastLetter = currentLetter;
                      }

                      return (
                        <React.Fragment key={game.id}>
                          {showHeader && (
                            <div className="col-span-full border-b border-white/20 pb-2 mt-8 mb-4">
                              <h3 className="font-mono text-xl sm:text-2xl font-black text-white tracking-widest uppercase">
                                [ {currentLetter} ]
                              </h3>
                            </div>
                          )}
                          <a
                            href={`/game/${game.slug}`}
                            className="group flex flex-col h-full bg-[#121217] border border-white/12 hover:border-white/35 rounded-2xl transition-all duration-300 relative select-none overflow-hidden text-left shadow-lg hover:shadow-2xl hover:-translate-y-1 cursor-pointer"
                          >
                            {/* Cover aspect ratio */}
                            <div className="aspect-[3/4] relative overflow-hidden bg-neutral-950 border-b border-white/10 shrink-0">
                               <HoverTrailer
                                trailerUrl={game.trailerUrl}
                                coverUrl={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending)}
                                altText={game.title}
                                aspectClass="w-full h-full"
                              />

                              {/* Trending & Category Badges */}
                              {(game as any).trendingRank && (game as any).trendingRank <= 50 ? (
                                <span 
                                  title={(game as any).trendingReason || `Top ${(game as any).trendingRank} trending horror game this week`}
                                  className="absolute top-2 left-2 text-[9px] font-mono font-bold bg-amber-400 text-black rounded-full px-2 py-0.5 z-10 select-none shadow-md flex items-center gap-1 tracking-tight"
                                >
                                  🔥 #{(game as any).trendingRank}
                                </span>
                              ) : badge ? (
                                <span className="absolute top-2 left-2 text-[9px] font-bold bg-[#7a3bfa] text-white rounded-full px-2 py-0.5 z-10 select-none shadow-sm">
                                  {badge}
                                </span>
                              ) : null}

                              {/* Rating Badge on cover */}
                              {renderRatingBadge(game)}

                              {/* Platform symbols bottom left */}
                              <div className="absolute bottom-2 left-2 z-10 flex gap-1 select-none">
                                <PlatformLogos platformNames={game.platformNames} />
                              </div>
                            </div>

                            {/* Text and Pricing */}
                            <div className="p-3.5 sm:p-4 flex-grow flex flex-col justify-between gap-2.5 bg-[#121217]">
                              <div className="space-y-1">
                                <h4 className="text-white font-bold text-xs sm:text-sm tracking-tight line-clamp-1 group-hover:text-white/90">
                                  {cleanTitle(game.title)}
                                </h4>
                                <span className="text-xs text-white/50 block font-medium truncate">
                                  {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-1 min-h-[28px]">
                                {/* Price / Cart block */}
                                {finalDeal ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {finalDeal.discountPercent > 0 && (
                                      <span className="text-[11px] font-sans font-bold bg-[#7a3bfa] text-white px-1.5 py-0.5 rounded select-none tracking-tight">
                                        -{finalDeal.discountPercent}%
                                      </span>
                                    )}
                                    <div className="flex flex-col items-start leading-none">
                                      <span className="font-sans text-sm sm:text-base font-bold text-white tracking-tight leading-none">
                                        {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
                                      </span>
                                      {finalDeal.discountPercent > 0 && (
                                        <span className="font-sans text-[11px] text-white/40 line-through mt-0.5 leading-none">
                                          {formatPrice(finalDeal.retailPrice, finalDeal.currency)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : itchLink ? (
                                  <span className="text-[10px] text-[#fa5c5c] font-bold border border-[#fa5c5c]/30 bg-[#fa5c5c]/10 px-2 py-0.5 rounded-full select-none uppercase tracking-wider">
                                    Itch.io
                                  </span>
                                ) : (
                                  <span className="text-xs text-white/30 font-medium select-none">—</span>
                                )}

                                <div className="flex items-center gap-1.5">
                                  {/* Release status tag */}
                                  <span className="text-[10px] text-white/70 border border-white/10 bg-white/5 px-2.5 py-0.5 rounded-full font-medium select-none">
                                    {game.status === "released" && game.releaseDate ? formatDate(game.releaseDate) : game.status}
                                  </span>

                                  {/* Add to Cart button */}
                                  {finalDeal && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        addToCart(game);
                                        setAddedIds(prev => new Set(prev).add(game.id));
                                        setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(game.id); return n; }), 1800);
                                      }}
                                      title="Add to cart"
                                      className={`shrink-0 p-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                                        addedIds.has(game.id)
                                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400"
                                          : "border-white/15 bg-white/5 text-white/60 hover:border-white hover:bg-white hover:text-black"
                                      }`}
                                    >
                                      {addedIds.has(game.id)
                                        ? <CheckCheck className="w-3.5 h-3.5" />
                                        : <ShoppingCart className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </a>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              ) : (
                /* List view rows */
                <div className="flex flex-col gap-3">
                  {(() => {
                    let lastLetter = "";
                    return games.map((game, idx) => {
                      const finalDeal = cheapestPriceSnapshot(game);
                    const itchLink = game.purchaseLinks?.find(l => l.storeName?.toLowerCase()?.includes("itch"))?.url;
                    const directLink = getDirectLink(game);
                    const badge = getCategoryBadge(game.category, game.title);

                      // Calculate current letter for breaks
                      const title = cleanTitle(game.title || "");
                      let currentLetter = title.trim().charAt(0).toUpperCase();
                      if (!currentLetter || !/[A-Z]/.test(currentLetter)) {
                        currentLetter = "#";
                      }

                      const showHeader = sortBy === "title" && currentLetter !== lastLetter;
                      if (showHeader) {
                        lastLetter = currentLetter;
                      }

                      return (
                        <React.Fragment key={game.id}>
                          {showHeader && (
                            <div className="border-b border-white/20 pb-2 mt-8 mb-4">
                              <h3 className="font-mono text-xl sm:text-2xl font-black text-white tracking-widest uppercase">
                                [ {currentLetter} ]
                              </h3>
                            </div>
                          )}
                          <a
                            href={`/game/${game.slug}`}
                            className="group flex flex-row items-center justify-between border border-white/12 hover:border-white/35 bg-[#121217] hover:bg-[#16161d] p-3.5 rounded-2xl select-none text-left gap-4 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                          >
                            {/* Cover thumbnail */}
                            <div className="relative shrink-0 w-12 h-16 bg-neutral-950 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center select-none shadow-sm">
                              {game.coverUrl && !failedImages[game.id] ? (
                                <img
                                  src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""}
                                  alt={game.title}
                                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                  onError={() => setFailedImages(prev => ({ ...prev, [game.id]: true }))}
                                />
                              ) : (
                                <span className="text-[10px] text-white/40 font-medium">[ NA ]</span>
                              )}
                            </div>

                            {/* Title and details */}
                            <div className="flex-grow min-w-0 space-y-1">
                              <h4 className="text-white font-bold text-xs sm:text-sm tracking-tight line-clamp-1 group-hover:text-white/90 flex items-center gap-2">
                                <span>{cleanTitle(game.title)}</span>
                                {badge && (
                                  <span className="text-[9px] font-bold bg-[#7a3bfa] text-white rounded-full px-2 py-0.5 select-none shadow-sm">
                                    {badge}
                                  </span>
                                )}
                              </h4>
                              <span className="text-xs text-white/50 block font-medium truncate max-w-sm">
                                by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
                              </span>
                            </div>

                            {/* Platform symbols list */}
                            <div className="hidden md:flex gap-1 shrink-0 select-none">
                              <PlatformLogos platformNames={game.platformNames} />
                            </div>

                            {/* Status */}
                            <div className="hidden sm:block shrink-0 min-w-[75px] text-right font-sans text-xs">
                              <span className="border border-white/10 bg-white/5 px-2.5 py-0.5 rounded-full text-[10px] text-white/70 font-medium select-none">
                                {game.status === "released" && game.releaseDate ? formatDate(game.releaseDate) : game.status}
                              </span>
                            </div>

                            {/* Rating badge - List view */}
                            <div className="shrink-0 min-w-[95px] flex flex-col items-center justify-center font-mono select-none">
                              {game.displayRating !== null && game.displayRating !== undefined ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${
                                    game.displayRating >= 90
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                      : game.displayRating >= 75
                                      ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                                      : game.displayRating >= 50
                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                      : "border-red-500/40 bg-red-500/10 text-red-400"
                                  }`}>
                                    {Math.round(game.displayRating)} / 100
                                  </div>
                                  {game.isAbsoluteCinema && (
                                    <span className="text-[7px] text-emerald-400 font-bold tracking-widest uppercase leading-none mt-0.5">
                                      ABSOLUTE CINEMA
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-white/20 text-xs font-mono">—</span>
                              )}
                            </div>

                            {/* Price block */}
                            <div className="shrink-0 min-w-[110px] flex flex-col items-end justify-center select-none gap-1.5">
                              {finalDeal ? (
                                <div className="flex items-center gap-2 justify-end">
                                  {finalDeal.discountPercent > 0 && (
                                    <span className="text-[11px] font-sans font-bold bg-[#7a3bfa] text-white px-1.5 py-0.5 rounded tracking-tight">
                                      -{finalDeal.discountPercent}%
                                    </span>
                                  )}
                                  <div className="text-right leading-none">
                                    <span className="font-sans text-sm sm:text-base font-bold text-white tracking-tight">
                                      {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
                                    </span>
                                    {finalDeal.discountPercent > 0 && (
                                      <span className="font-sans text-[11px] text-white/40 line-through block mt-0.5 leading-none">
                                        {formatPrice(finalDeal.retailPrice, finalDeal.currency)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : itchLink ? (
                                <span className="text-[9px] text-[#fa5c5c] font-bold border border-[#fa5c5c]/30 bg-[#fa5c5c]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Itch.io
                                </span>
                              ) : (
                                <span className="text-xs text-white/30 font-medium uppercase">—</span>
                              )}

                              {/* Add to Cart button — list view */}
                              {finalDeal && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    addToCart(game);
                                    setAddedIds(prev => new Set(prev).add(game.id));
                                    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(game.id); return n; }), 1800);
                                  }}
                                  title="Add to cart"
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-semibold transition-all duration-200 cursor-pointer ${
                                    addedIds.has(game.id)
                                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400"
                                      : "border-white/15 bg-white/5 text-white/60 hover:border-white hover:bg-white hover:text-black"
                                  }`}
                                >
                                  {addedIds.has(game.id)
                                    ? <><CheckCheck className="w-3 h-3" /> Added</>  
                                    : <><ShoppingCart className="w-3 h-3" /> Cart</>}
                                </button>
                              )}
                            </div>
                          </a>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Hover popover card removed */}
            </div>
          )}

          {totalPages > 1 && !loading && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
              <span className="font-mono text-xs text-white/50">
                Showing games <span className="text-white font-bold">{Math.min(totalCount, (currentPage - 1) * gamesPerPage + 1)}</span> to{" "}
                <span className="text-white font-bold">{Math.min(totalCount, currentPage * gamesPerPage)}</span> of{" "}
                <span className="text-white font-bold">{totalCount}</span> entries
              </span>

              {/* Bottom Pagination full list */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  disabled={currentPage === 1 || loading}
                  onClick={() => changePage(1)}
                  className="w-9 h-9 border border-white/10 text-white flex items-center justify-center hover:bg-neutral-900 hover:border-white disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:border-white/10 cursor-pointer disabled:cursor-not-allowed"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === 1 || loading}
                  onClick={() => changePage(Math.max(1, currentPage - 1))}
                  className="w-9 h-9 border border-white/10 text-white flex items-center justify-center hover:bg-neutral-900 hover:border-white disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:border-white/10 cursor-pointer disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {renderPaginationNumbers()}

                <button
                  disabled={currentPage === totalPages || loading}
                  onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
                  className="w-9 h-9 border border-white/10 text-white flex items-center justify-center hover:bg-neutral-900 hover:border-white disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:border-white/10 cursor-pointer disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages || loading}
                  onClick={() => changePage(totalPages)}
                  className="w-9 h-9 border border-white/10 text-white flex items-center justify-center hover:bg-neutral-900 hover:border-white disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:border-white/10 cursor-pointer disabled:cursor-not-allowed"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
