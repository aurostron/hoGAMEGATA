"use client";

import { useState, useEffect } from "react";
import { 
  SlidersHorizontal, 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  Download, 
  Bookmark, 
  LifeBuoy, 
  Info, 
  PlusCircle 
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useAuth, AuthProvider } from "@/context/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";

function SettingsButtonInner() {
  const { user, logout } = useAuth();
  const { openModal } = usePreferences();
  const [pathname, setPathname] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setPathname(window.location.pathname);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("To install hoGAMEGATA on iOS:\n1. Tap the Share button in Safari.\n2. Scroll down and tap 'Add to Home Screen'.");
      } else {
        alert("To install hoGAMEGATA on your device:\n1. Open browser options (⋮ or ⋯ menu).\n2. Tap 'Install app' or 'Add to Home screen'.");
      }
    }
  };

  const displayName = user?.email ? user.email.split("@")[0] : "";
  const initial = (displayName.charAt(0) || "U").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center justify-center font-mono text-xs text-white hover:bg-white/10 transition-all duration-150 w-full h-full rounded-xl font-bold cursor-pointer bg-transparent border-none outline-none"
        title="Account & Settings"
      >
        {user?.avatarUrl ? (
          <img 
            src={user.avatarUrl} 
            alt="User Profile" 
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white/20" 
            referrerPolicy="no-referrer" 
          />
        ) : user ? (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-white/20">
            {initial}
          </div>
        ) : (
          <UserIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white/90" />
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-72 sm:w-80 p-2 shadow-2xl">
        {/* 1. Header Greeting Section */}
        <div className="p-3 mb-1.5 rounded-xl bg-white/[0.04] border border-white/10 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-rose-500/15 via-purple-500/10 to-transparent blur-xl pointer-events-none rounded-full" />
          
          {user ? (
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-md border border-white/20 shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate font-sans">
                    Hello, <strong className="text-white font-extrabold">{displayName}</strong>!
                  </span>
                  {isAdmin && (
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shrink-0">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-white/50 truncate block font-sans">
                  {user.email}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white font-sans">
                  Hello there! 👋
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-snug font-sans">
                Sign in to track games, manage your wishlist, and save library ratings.
              </p>
              <a
                href={`/login?redirect=${encodeURIComponent(pathname || "/")}`}
                className="w-full mt-2 py-2 px-3 bg-white text-black hover:bg-white/90 text-xs font-bold font-sans rounded-xl flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] shadow-sm decoration-none"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </a>
            </div>
          )}
        </div>

        {/* 2. Personalize & App Section */}
        <DropdownMenuLabel>Personalize</DropdownMenuLabel>
        <DropdownMenuItem onClick={openModal} className="cursor-pointer">
          <SlidersHorizontal className="w-4 h-4 text-white/60" />
          <span className="flex-1">Preferences & Filters</span>
        </DropdownMenuItem>

        {!isStandalone && (
          <DropdownMenuItem onClick={handleInstallPWA} className="cursor-pointer text-emerald-300 hover:text-emerald-200">
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="flex-1 font-semibold">Install App</span>
            <span className="font-mono text-[9px] uppercase border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold">PWA</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* 3. Community & Features Section */}
        <DropdownMenuLabel>Platform</DropdownMenuLabel>
        {user && (
          <DropdownMenuItem className="p-0">
            <a href="/dashboard" className="flex items-center gap-2.5 w-full h-full px-3 py-2 text-inherit decoration-none">
              <Bookmark className="w-4 h-4 text-white/60" />
              <span className="flex-1">Wishlist & Tracker</span>
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="p-0">
          <a href="/submit-game" className="flex items-center gap-2.5 w-full h-full px-3 py-2 text-inherit decoration-none">
            <PlusCircle className="w-4 h-4 text-white/60" />
            <span className="flex-1">Submit a Game</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="p-0">
          <a href="/support" className="flex items-center gap-2.5 w-full h-full px-3 py-2 text-inherit decoration-none">
            <LifeBuoy className="w-4 h-4 text-white/60" />
            <span className="flex-1">Support & FAQ</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="p-0">
          <a href="/about" className="flex items-center gap-2.5 w-full h-full px-3 py-2 text-inherit decoration-none">
            <Info className="w-4 h-4 text-white/60" />
            <span className="flex-1">About hoGAMEGATA</span>
          </a>
        </DropdownMenuItem>


        {/* 5. Account Actions */}
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} variant="destructive" className="cursor-pointer">
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="flex-1 font-semibold">Sign Out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SettingsButton() {
  return (
    <AuthProvider>
      <SettingsButtonInner />
    </AuthProvider>
  );
}
