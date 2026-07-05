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
    <div ref={searchRef} className="relative font-mono flex items-center">
      {/* Collapsed Search Button */}
      {!isExpanded ? (
        <button
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center justify-center font-mono text-xs text-white hover:bg-white hover:text-black transition-all duration-150 border border-transparent hover:border-white w-11 h-11 sm:w-12 sm:h-12 rounded-none font-bold cursor-pointer bg-black"
          title="Search"
        >
          <Search className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
        </button>
      ) : (
        /* Expanded Search Input Bar */
        <div className="relative w-40 sm:w-60">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {loading ? (
              <Loader2 className="h-4.5 w-4.5 text-white/70 animate-spin" />
            ) : (
              <Search className="h-4.5 w-4.5 text-white/70" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setIsOpen(true)}
            placeholder="Search games..."
            className="block w-full h-11 sm:h-12 pl-10 pr-8 bg-black border border-white text-sm text-white placeholder-white/50 focus:outline-none rounded-none transition-all duration-150 font-sans tracking-wide"
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
            <span className="text-[10px] font-bold">[✕]</span>
          </button>
        </div>
      )}

      {/* Autocomplete Dropdown list */}
      {isOpen && isExpanded && (
        <div className="absolute right-0 top-full mt-1.5 w-64 sm:w-80 bg-black border-2 border-white z-50 divide-y divide-white/20 max-h-64 overflow-y-auto shadow-[4px_4px_0px_0px_#ffffff] flex flex-col">
          {results.length > 0 ? (
            results.map((game) => (
              <button
                key={game.id}
                onClick={() => handleSelectGame(game.slug)}
                className="w-full text-left px-4 py-2.5 hover:bg-white hover:text-black transition-colors duration-150 cursor-pointer flex flex-col gap-0.5 select-none rounded-none outline-none border-none bg-transparent group"
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
            <div className="px-4 py-3 text-[10px] text-white/40 uppercase tracking-widest text-center select-none">
              [ No games found ]
            </div>
          )}
        </div>
      )}
    </div>
  );
}
