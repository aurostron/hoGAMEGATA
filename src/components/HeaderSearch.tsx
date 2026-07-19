import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

interface GameSearchResult {
  id: string;
  title: string;
  slug: string;
  developerNames: string | null;
}

export default function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/games?search=${encodeURIComponent(query)}&limit=6`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.games || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Header search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
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
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center justify-center text-white hover:bg-white/5 w-11 sm:w-12 h-full transition-colors duration-150 cursor-pointer rounded-xl"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      ) : (
        /* Expanded Search Input Bar (Mobile Full-Width Overlay vs Desktop Inline Input) */
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
        <div className="fixed top-14 left-3 right-3 sm:absolute sm:top-full sm:left-auto sm:right-0 mt-1.5 sm:w-80 bg-black/95 backdrop-blur-md border border-white/20 rounded-xl z-50 divide-y divide-white/10 max-h-72 overflow-y-auto shadow-2xl flex flex-col">
          {results.length > 0 ? (
            results.map((game) => (
              <button
                key={game.id}
                onClick={() => handleSelectGame(game.slug)}
                className="w-full text-left px-4 py-3 hover:bg-white hover:text-black transition-colors duration-150 cursor-pointer flex flex-col gap-0.5 select-none outline-none border-none bg-transparent group"
              >
                <span className="font-sans text-xs font-bold tracking-tight block">
                  {game.title}
                </span>
                {game.developerNames && (
                  <span className="font-mono text-[9px] text-white/50 group-hover:text-black/50 block font-medium transition-colors">
                    by {game.developerNames}
                  </span>
                )}
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
              [ Try Project Oracle AI Search → ]
            </a>
          )}
        </div>
      )}
    </div>
  );
}
