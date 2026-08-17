import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Gamepad2,
  Search,
  Dices,
  Shuffle,
  MoreHorizontal,
  X,
  CalendarClock,
  Send,
  BookOpen,
  LifeBuoy,
  Info,
  ShoppingCart,
  Settings,
  ChevronRight,
} from "lucide-react";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** URL to navigate or "action:xxx" for special behavior */
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: <Home strokeWidth={1.8} />, href: "/" },
  {
    id: "games",
    label: "Games",
    icon: <Gamepad2 strokeWidth={1.8} />,
    href: "/games",
  },
  {
    id: "search",
    label: "Search",
    icon: <Search strokeWidth={1.8} />,
    href: "action:search",
  },
  {
    id: "random",
    label: "Random",
    icon: <Dices strokeWidth={1.8} />,
    href: "action:random",
  },
  {
    id: "more",
    label: "More",
    icon: <MoreHorizontal strokeWidth={1.8} />,
    href: "action:more",
  },
];

const MORE_ITEMS = [
  {
    label: "Upcoming Games",
    icon: <CalendarClock size={18} strokeWidth={1.6} />,
    href: "/upcoming",
  },
  {
    label: "Submit a Game",
    icon: <Send size={18} strokeWidth={1.6} />,
    href: "/submit-game",
  },
  {
    label: "Blog",
    icon: <BookOpen size={18} strokeWidth={1.6} />,
    href: "/blog",
  },
  {
    label: "Support",
    icon: <LifeBuoy size={18} strokeWidth={1.6} />,
    href: "/support",
  },
  {
    label: "About",
    icon: <Info size={18} strokeWidth={1.6} />,
    href: "/about",
  },
  {
    label: "Cart",
    icon: <ShoppingCart size={18} strokeWidth={1.6} />,
    href: "action:cart",
  },
  {
    label: "Settings",
    icon: <Settings size={18} strokeWidth={1.6} />,
    href: "action:settings",
  },
];

/* ──────────────────────────────────────────────
   Spring configs for "Flutter feel"
   ────────────────────────────────────────────── */
const indicatorSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

const scaleSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25,
  mass: 0.8,
};

const tapSpring = { scale: 0.88 };

/* ──────────────────────────────────────────────
   Route detection helper
   ────────────────────────────────────────────── */
function getActiveId(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/games") || pathname.startsWith("/game/") || pathname.startsWith("/directory"))
    return "games";
  if (pathname.startsWith("/search")) return "search";
  return "home";
}

/* ──────────────────────────────────────────────
   BottomNav Component
   ────────────────────────────────────────────── */
export default function BottomNav() {
  const [activeId, setActiveId] = useState(() =>
    typeof window !== "undefined" ? getActiveId(window.location.pathname) : "home"
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const [hiddenByFooter, setHiddenByFooter] = useState(false);

  // Smoothly fade out bottom nav when reaching footer
  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    const setupObserver = () => {
      const footer = document.querySelector("footer");
      if (!footer) return;

      if (observer) observer.disconnect();

      observer = new IntersectionObserver(
        ([entry]) => {
          setHiddenByFooter(entry.isIntersecting);
        },
        {
          root: null,
          threshold: 0.05,
        }
      );

      observer.observe(footer);
    };

    setupObserver();

    // Re-bind on Astro View Transitions & page loads
    const onPageLoad = () => {
      setActiveId(getActiveId(window.location.pathname));
      setupObserver();
    };

    document.addEventListener("astro:page-load", onPageLoad);
    return () => {
      if (observer) observer.disconnect();
      document.removeEventListener("astro:page-load", onPageLoad);
    };
  }, []);

  // Close More drawer on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  // Close More drawer on Escape
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moreOpen]);

  const handleNavClick = useCallback(
    (item: NavItem) => {
      if (item.href === "action:search") {
        // Trigger the existing HeaderSearch by clicking its button
        const searchBtn = document.querySelector<HTMLButtonElement>(
          'header button[title="Search"]'
        );
        if (searchBtn) {
          searchBtn.click();
        } else {
          window.location.assign("/search");
        }
        return;
      }

      if (item.href === "action:random") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("gamegata:random-warp"));
        }
        return;
      }

      if (item.href === "action:more") {
        setMoreOpen((prev) => !prev);
        return;
      }

      // Regular navigation
      setActiveId(item.id);
      setMoreOpen(false);
      window.location.assign(item.href);
    },
    []
  );

  const handleMoreItemClick = useCallback((href: string) => {
    setMoreOpen(false);
    if (href === "action:cart") {
      // Trigger existing CartButton
      const cartBtn = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Open cart"], header button:has(.lucide-shopping-cart)'
      );
      if (cartBtn) cartBtn.click();
      return;
    }
    if (href === "action:settings") {
      // Trigger existing SettingsButton
      const settingsBtn = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Settings"], header button:has(.lucide-sliders-horizontal), header button:has(.lucide-settings)'
      );
      if (settingsBtn) settingsBtn.click();
      return;
    }
    window.location.assign(href);
  }, []);

  return (
    <>
      {/* ── Floating Bottom Bar (Mobile Only: md:hidden) ── */}
      <nav
        className={`md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] select-none w-auto max-w-[calc(100vw-2rem)] transition-all duration-300 ${
          hiddenByFooter ? "opacity-0 pointer-events-none translate-y-6" : "opacity-100 pointer-events-auto translate-y-0"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 28,
            delay: 0.3,
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-2xl border border-white/15 bg-[#0d0d0f]/65 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.id;
            const isMore = item.id === "more";

            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item)}
                whileTap={tapSpring}
                className="relative flex flex-col items-center justify-center cursor-pointer outline-none border-none bg-transparent px-3.5 py-1.5 rounded-xl min-w-[58px] group"
                aria-label={item.label}
              >
                {/* Active background indicator — slides between items */}
                {isActive && !isMore && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="absolute inset-0 rounded-xl bg-white/15 shadow-inner"
                    transition={indicatorSpring}
                  />
                )}

                {/* Icon */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    y: isActive ? -0.5 : 0,
                  }}
                  transition={scaleSpring}
                  className={`relative z-10 w-5 h-5 transition-colors duration-200 ${
                    isActive
                      ? "text-white"
                      : "text-white/70 group-hover:text-white"
                  }`}
                >
                  {item.icon}
                </motion.div>

                {/* Label */}
                <motion.span
                  animate={{
                    opacity: isActive ? 1 : 0.75,
                    y: isActive ? 0 : 0.5,
                  }}
                  transition={scaleSpring}
                  className={`relative z-10 mt-1 font-sans text-[10px] font-semibold tracking-tight leading-none ${
                    isActive
                      ? "text-white font-bold"
                      : "text-white/70 group-hover:text-white"
                  }`}
                >
                  {item.label}
                </motion.span>
              </motion.button>
            );
          })}
        </motion.div>
      </nav>

      {/* ── More Drawer ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              ref={moreRef}
              key="more-drawer"
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 32,
              }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[61] bg-[#111114]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-2xl pb-24 max-h-[70vh] overflow-y-auto shadow-2xl"
            >
              {/* Drawer handle */}
              <div className="flex justify-center py-3">
                <div className="w-8 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  More
                </h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              {/* Items */}
              <div className="px-3 pb-4">
                {MORE_ITEMS.map((item, i) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.04,
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                    whileTap={{ scale: 0.97, backgroundColor: "rgba(255,255,255,0.04)" }}
                    onClick={() => handleMoreItemClick(item.href)}
                    className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left hover:bg-white/[0.04] transition-colors duration-150 cursor-pointer bg-transparent border-none outline-none group"
                  >
                    <span className="text-white/40 group-hover:text-white/70 transition-colors duration-150">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-[13px] font-sans font-medium text-white/70 group-hover:text-white/90 tracking-tight transition-colors duration-150">
                      {item.label}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      className="text-white/15 group-hover:text-white/30 transition-colors duration-150"
                    />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
