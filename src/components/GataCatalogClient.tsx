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

const CATEGORIES = [
  { 
    name: "Classic", 
    filterType: "tags", 
    filterValue: "retro", 
    gradient: "from-red-950/75 via-neutral-900/80 to-black/90 border-red-950/30 hover:border-red-600/60", 
    desc: "Retro psychological dread",
    bgImage: "https://img.itch.zone/aW1hZ2UvMTg2NTI5Mi8xMDk2MzMwNy5wbmc=/original/MwuFZC.png"
  },
  { 
    name: "Strategy", 
    filterType: "genres", 
    filterValue: "strategy", 
    gradient: "from-indigo-950/75 via-neutral-900/80 to-black/90 border-indigo-950/30 hover:border-indigo-600/60", 
    desc: "Tactical resources & planning",
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/sciazw.jpg"
  },
  { 
    name: "Adventure", 
    filterType: "genres", 
    filterValue: "adventure", 
    gradient: "from-emerald-950/75 via-neutral-900/80 to-black/90 border-emerald-950/30 hover:border-emerald-600/60", 
    desc: "Narrative & exploration",
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/scrris.jpg"
  },
  { 
    name: "Indie", 
    filterType: "genres", 
    filterValue: "indie", 
    gradient: "from-fuchsia-950/75 via-neutral-900/80 to-black/90 border-fuchsia-950/30 hover:border-fuchsia-600/60", 
    desc: "Lo-fi experimental nightmares",
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/sc9d42.jpg"
  },
  { 
    name: "Role-Playing", 
    filterType: "genres", 
    filterValue: "role-playing-rpg", 
    gradient: "from-amber-950/75 via-neutral-900/80 to-black/90 border-amber-950/30 hover:border-amber-600/60", 
    desc: "RPG survival elements",
    bgImage: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/zsco1iaj6riez8rpzphh.jpg"
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

const SORT_OPTIONS = [
  { label: "Bestselling (Trending)", value: "trending" },
  { label: "Release Date (Latest)", value: "latest" },
  { label: "Release Date (Upcoming)", value: "upcoming" },
  { label: "Rating (Top Rated)", value: "top-rated" },
  { label: "Price (Low to High)", value: "price-asc" },
  { label: "Price (High to Low)", value: "price-desc" },
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
      setDebouncedSearch(params.get("search") || "");
      setSortBy(params.get("sort") || "trending");
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
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.set("search", debouncedSearch);
        if (sortBy) queryParams.set("sort", sortBy);
        if (!hideDlcs) queryParams.set("hideDlcs", "false");
        if (freeOnly) queryParams.set("freeOnly", "true");
        if (minPrice) queryParams.set("minPrice", minPrice);
        
        // Use slider price if not explicitly overridden by maxPrice input
        const finalMaxPrice = maxPrice || (debouncedPriceSlider < dbMaxPrice ? debouncedPriceSlider.toString() : "");
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

        const res = await fetch(`/api/games?${queryParams.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) {
            setGames(data.games || []);
            setTotalCount(data.totalCount || 0);
            if (data.maxPrice && data.maxPrice > 0) {
              setDbMaxPrice(data.maxPrice);
              // Default slider to max if never moved
              if (priceSlider === 60) setPriceSlider(data.maxPrice);
            }

            if (data.correctedQuery) {
              setCorrectedQuery(data.correctedQuery);
              setOriginalSearch(debouncedSearch);
            }
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
    selectedFeatures
  ]);

  // Category cards click handlers
  const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
    setCurrentPage(1);
    if (category.filterType === "genres") {
      setSelectedGenres(prev => 
        prev.includes(category.filterValue) 
          ? prev.filter(g => g !== category.filterValue)
          : [...prev, category.filterValue]
      );
    } else if (category.filterType === "tags") {
      setSelectedFeatures(prev => 
        prev.includes(category.filterValue)
          ? prev.filter(f => f !== category.filterValue)
          : [...prev, category.filterValue]
      );
    }
  };

  const isCategoryActive = (category: typeof CATEGORIES[0]) => {
    if (category.filterType === "genres") {
      return selectedGenres.includes(category.filterValue);
    } else if (category.filterType === "tags") {
      return selectedFeatures.includes(category.filterValue);
    }
    return false;
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
      {/* ── Top Category Cards ── */}
      <div className="flex lg:grid lg:grid-cols-5 gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 snap-x scrollbar-none select-none">
        {CATEGORIES.map((cat, i) => {
          const active = isCategoryActive(cat);
          return (
            <button
              key={i}
              onClick={() => handleCategoryClick(cat)}
              className={`flex-shrink-0 w-36 sm:w-44 lg:w-auto snap-start border p-3 sm:p-4 text-left flex flex-col justify-between transition-all duration-300 relative group min-h-[95px] sm:min-h-[110px] cursor-pointer bg-gradient-to-br ${cat.gradient} overflow-hidden
                ${active 
                  ? "shadow-[0_0_20px_rgba(255,255,255,0.08)] scale-102 border-white! text-white" 
                  : "text-white/70 hover:text-white"
                }`}
            >
              {cat.bgImage && (
                <div className="absolute inset-0 w-full h-full z-0 transition-transform duration-500 group-hover:scale-105 pointer-events-none overflow-hidden">
                  <img
                    src={cat.bgImage}
                    alt=""
                    className="w-full h-full object-cover filter brightness-[0.55] group-hover:brightness-[0.70] contrast-[1.05] transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />
                </div>
              )}
              <div className="flex justify-between items-start w-full relative z-10">
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 font-bold group-hover:text-white/50 transition-colors">
                  // 0{i + 1}
                </span>
                {active && (
                  <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_#dc2626]" />
                )}
              </div>
              <div className="mt-3 relative z-10">
                <h4 className="font-sans font-black uppercase text-sm sm:text-base tracking-wider leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                  {cat.name}
                </h4>
              </div>
            </button>
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search games by title, developer, genre, or keyword..."
                  className="w-full h-12 pl-11 pr-24 bg-[#121216] hover:bg-[#16161c] text-xs sm:text-sm text-white placeholder:text-white/40 rounded-full focus:outline-none focus:bg-[#181820] transition-all duration-200 font-sans tracking-wide"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                  {searchQuery ? (
                    <button 
                      onClick={() => setSearchQuery("")}
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
                  onClick={() => setSearchQuery("")} 
                  className="text-white/40 hover:text-white transition-colors cursor-pointer text-xs underline font-medium"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Spelling auto-correction banner (Google styled) */}
          {correctedQuery && (
            <div className="border border-emerald-500/30 bg-emerald-500/5 p-4 font-mono text-xs uppercase flex items-center justify-between gap-3 text-white/80 animate-fade-in">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Showing results for <strong className="text-white underline">{correctedQuery}</strong>{" "}
                  <span className="text-white/40">(searched instead for "{originalSearch}")</span>
                </span>
              </span>
              <button 
                onClick={() => {
                  setSearchQuery(originalSearch);
                  setCorrectedQuery(null);
                }}
                className="text-[10px] border border-white/20 px-2 py-0.5 hover:bg-white hover:text-black font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Search "{originalSearch}" instead
              </button>
            </div>
          )}

          {/* Header titles & counts */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                PC games / All Games ({totalCount})
              </h2>
              {initialTotalGames && (
                <span className="font-mono text-[10px] text-white/40 block mt-1 uppercase font-bold tracking-wider">
                  of {initialTotalGames} games in total
                </span>
              )}
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

          {/* ── Sort & Layout Controls Top Bar ── */}
          <div className="flex items-center justify-between bg-[#0f0f12] border border-[#222227] p-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-white/45 uppercase tracking-widest font-bold">
                Sort by:
              </span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setCurrentPage(1);
                  setSortBy(e.target.value);
                }}
                className="bg-[#1b1b22] border border-[#2d2d38] px-3 py-1.5 text-xs text-white font-mono rounded-none focus:outline-none focus:border-white/50 font-bold cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Layout Mode Toggles */}
            <div className="flex border border-[#2d2d38]">
              <button
                onClick={() => changeLayoutMode("grid")}
                className={`p-1.5 transition-colors cursor-pointer
                  ${layoutMode === "grid" 
                    ? "bg-white text-black" 
                    : "text-white/60 hover:text-white hover:bg-[#20202a]"}`}
                title="Grid layout"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeLayoutMode("list")}
                className={`p-1.5 transition-colors cursor-pointer border-l border-[#2d2d38]
                  ${layoutMode === "list" 
                    ? "bg-white text-black" 
                    : "text-white/60 hover:text-white hover:bg-[#20202a]"}`}
                title="List layout"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Game List Layouts ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 min-h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
              <span className="font-mono text-xs uppercase tracking-widest text-white/40 font-bold animate-pulse">
                Hang on...
              </span>
            </div>
          ) : games.length === 0 ? (
            <div className="border border-white/10 text-center py-24 min-h-[300px] flex flex-col justify-center items-center">
              <span className="font-mono text-xs text-white/50 uppercase font-black tracking-widest mb-2">NO GAMES FOUND</span>
              <p className="font-mono text-[10px] text-white/30 max-w-sm leading-relaxed uppercase">
                Modify your active filters or clear search query.
              </p>
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
                            className="group flex flex-col h-full bg-[#131316] border border-[#222227] hover:border-[#3a3a42] rounded-none transition-all duration-300 relative select-none overflow-hidden text-left shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 cursor-pointer"
                          >
                            {/* Cover aspect ratio */}
                            <div className="aspect-[3/4] relative overflow-hidden bg-neutral-950 border-b border-[#222227] shrink-0">
                               <HoverTrailer
                                trailerUrl={game.trailerUrl}
                                coverUrl={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending)}
                                altText={game.title}
                                aspectClass="w-full h-full"
                              />

                              {/* Category Badge on cover */}
                              {badge && (
                                <span className="absolute top-2 left-2 font-mono text-[8px] uppercase tracking-widest bg-[#7a3bfa] text-white font-bold px-1.5 py-0.5 z-10 select-none">
                                  {badge}
                                </span>
                              )}

                              {/* Rating Badge on cover */}
                              {renderRatingBadge(game)}

                              {/* Platform symbols bottom left */}
                              <div className="absolute bottom-2 left-2 z-10 flex gap-1 select-none">
                                <PlatformLogos platformNames={game.platformNames} />
                              </div>
                            </div>

                            {/* Text and Pricing */}
                            <div className="p-3 sm:p-4 flex-grow flex flex-col justify-between gap-2.5 bg-[#18181c]">
                              <div className="space-y-1">
                                <h4 className="text-white font-bold uppercase text-xs tracking-wider line-clamp-1 group-hover:underline">
                                  {cleanTitle(game.title)}
                                </h4>
                                <span className="font-mono text-[10px] text-white/40 block leading-tight">
                                  {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-1 min-h-[28px]">
                                {/* Price / Cart block */}
                                {finalDeal ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {finalDeal.discountPercent > 0 && (
                                      <span className="font-mono text-[10px] font-black bg-[#7a3bfa] text-white px-1.5 py-0.5 select-none">
                                        -{finalDeal.discountPercent}%
                                      </span>
                                    )}
                                    <div className="flex flex-col items-start leading-none">
                                      <span className="font-mono text-xs font-bold text-white leading-none">
                                        {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
                                      </span>
                                      {finalDeal.discountPercent > 0 && (
                                        <span className="font-mono text-[9px] text-white/30 line-through mt-0.5">
                                          {formatPrice(finalDeal.retailPrice, finalDeal.currency)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : itchLink ? (
                                  <span className="font-mono text-[10px] text-[#fa5c5c] font-black border border-[#fa5c5c]/30 bg-[#fa5c5c]/5 px-2 py-1 select-none uppercase tracking-wider">
                                    Itch.io
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-white/20 uppercase select-none">—</span>
                                )}

                                <div className="flex items-center gap-1.5">
                                  {/* Release status tag */}
                                  <span className="font-mono text-[9px] text-white/75 border border-white/20 bg-white/5 px-2 py-0.5 uppercase tracking-widest font-black select-none">
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
                                      className={`shrink-0 p-1 border transition-all duration-200 cursor-pointer ${
                                        addedIds.has(game.id)
                                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400"
                                          : "border-white/15 bg-white/5 text-white/50 hover:border-white/50 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      {addedIds.has(game.id)
                                        ? <CheckCheck className="w-3 h-3" />
                                        : <ShoppingCart className="w-3 h-3" />}
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
                            className="group flex flex-row items-center justify-between border border-[#222227] hover:border-[#3a3a42] bg-[#131316] hover:bg-[#18181c] p-3 select-none text-left gap-4 shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                          >
                            {/* Cover thumbnail */}
                            <div className="relative shrink-0 w-12 h-16 bg-neutral-950 border border-[#222227] overflow-hidden flex items-center justify-center select-none">
                              {game.coverUrl && !failedImages[game.id] ? (
                                <img
                                  src={getCloudinaryFetchUrl(getHighResCoverUrl(game.coverUrl), game.isTrending) || ""}
                                  alt={game.title}
                                  className="object-cover w-full h-full"
                                  loading="lazy"
                                  onError={() => setFailedImages(prev => ({ ...prev, [game.id]: true }))}
                                />
                              ) : (
                                <span className="font-mono text-[8px] uppercase tracking-widest text-white/40 font-bold">[ NA ]</span>
                              )}
                            </div>

                            {/* Title and details */}
                            <div className="flex-grow min-w-0 space-y-1">
                              <h4 className="text-white font-bold uppercase text-xs tracking-wider line-clamp-1 group-hover:underline flex items-center gap-2">
                                <span>{cleanTitle(game.title)}</span>
                                {badge && (
                                  <span className="font-mono text-[8px] uppercase tracking-widest bg-[#7a3bfa] text-white font-bold px-1 py-0.2 select-none">
                                    {badge}
                                  </span>
                                )}
                              </h4>
                              <span className="font-mono text-[10px] text-white/40 block leading-tight truncate max-w-sm">
                                by {game.developerNames ? game.developerNames.split(", ")[0] : "Unknown Developer"}
                              </span>
                            </div>

                            {/* Platform symbols list */}
                            <div className="hidden md:flex gap-1 shrink-0 select-none">
                              <PlatformLogos platformNames={game.platformNames} />
                            </div>

                            {/* Status */}
                            <div className="hidden sm:block shrink-0 min-w-[75px] text-right font-mono text-[9px] text-white/70 uppercase">
                              <span className="border border-white/20 bg-white/5 px-1.5 py-0.5 tracking-wider font-bold select-none">
                                {game.status === "released" && game.releaseDate ? formatDate(game.releaseDate) : game.status}
                              </span>
                            </div>

                            {/* Rating badge - List view */}
                            <div className="shrink-0 min-w-[95px] flex flex-col items-center justify-center font-mono select-none">
                              {game.displayRating !== null && game.displayRating !== undefined ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`px-2 py-0.5 border text-[10px] font-black tracking-wider ${
                                    game.displayRating >= 90
                                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                      : game.displayRating >= 75
                                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                      : game.displayRating >= 50
                                      ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                                      : "border-red-500/50 bg-red-500/10 text-red-400"
                                  }`}>
                                    {Math.round(game.displayRating)} / 100
                                  </div>
                                  {game.isAbsoluteCinema && (
                                    <span className="text-[7px] text-emerald-400 font-black tracking-widest uppercase leading-none mt-0.5">
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
                                    <span className="font-mono text-[10px] font-black bg-[#7a3bfa] text-white px-1.5 py-0.5">
                                      -{finalDeal.discountPercent}%
                                    </span>
                                  )}
                                  <div className="text-right leading-none">
                                    <span className="font-mono text-xs font-bold text-white">
                                      {formatPrice(finalDeal.dealPrice, finalDeal.currency)}
                                    </span>
                                    {finalDeal.discountPercent > 0 && (
                                      <span className="font-mono text-[9px] text-white/30 line-through block mt-0.5">
                                        {formatPrice(finalDeal.retailPrice, finalDeal.currency)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : itchLink ? (
                                <span className="font-mono text-[9px] text-[#fa5c5c] font-black border border-[#fa5c5c]/30 bg-[#fa5c5c]/5 px-2 py-0.5 uppercase tracking-wider">
                                  Itch.io
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-white/20 uppercase">—</span>
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
                                  className={`flex items-center gap-1 px-2 py-1 border font-mono text-[9px] uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer ${
                                    addedIds.has(game.id)
                                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                                      : "border-white/15 bg-white/5 text-white/40 hover:border-white/50 hover:bg-white/10 hover:text-white"
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
