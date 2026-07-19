"use client";

import { useState, useEffect } from "react";
import { MoreVertical, BookOpen, Sliders, Layout, LogIn, LogOut, User as UserIcon, Download } from "lucide-react";
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
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Sync pathname and layout from localStorage on mount and listen to changes
  useEffect(() => {
    setPathname(window.location.pathname);

    const saved = localStorage.getItem("gata-mobile-layout");
    if (saved === "list" || saved === "grid") {
      setLayout(saved);
    }

    const handleLayoutChange = () => {
      const saved = localStorage.getItem("gata-mobile-layout");
      if (saved === "list" || saved === "grid") {
        setLayout(saved);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    window.addEventListener("gata-mobile-layout-changed", handleLayoutChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("gata-mobile-layout-changed", handleLayoutChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const toggleLayout = (newLayout: "grid" | "list") => {
    localStorage.setItem("gata-mobile-layout", newLayout);
    setLayout(newLayout);
    window.dispatchEvent(new Event("gata-mobile-layout-changed"));
  };

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <button data-tour="options-button" className="flex items-center justify-center font-mono text-xs text-white hover:bg-white/10 transition-all duration-150 w-full h-full rounded-xl font-bold cursor-pointer bg-transparent" title="More Options">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="User Profile" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/20" referrerpolicy="no-referrer" />
          ) : (
            <MoreVertical className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          )}
        </button>
      } />
      
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {/* Layout controls */}
        <DropdownMenuLabel>Layout Mode</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toggleLayout("grid")} className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5" /> Grid View
          </span>
          <span className="font-bold">{layout === "grid" ? "[X]" : "[ ]"}</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => toggleLayout("list")} className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5" /> List View
          </span>
          <span className="font-bold">{layout === "list" ? "[X]" : "[ ]"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Preferences & App Install */}
        <DropdownMenuLabel>Personalize</DropdownMenuLabel>
        <DropdownMenuItem onClick={openModal} className="flex items-center gap-1.5 cursor-pointer">
          <Sliders className="w-3.5 h-3.5" /> Preferences
        </DropdownMenuItem>

        {!isStandalone && (
          <DropdownMenuItem onClick={handleInstallPWA} className="flex items-center justify-between cursor-pointer text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Install App
            </span>
            <span className="font-mono text-[9px] uppercase border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded">PWA</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Resources */}
        <DropdownMenuLabel>Resources</DropdownMenuLabel>
        <DropdownMenuItem className="p-0">
          <a href="/status" className="flex items-center gap-1.5 w-full h-full px-3 py-2 text-inherit decoration-none">
            <Sliders className="w-3.5 h-3.5" /> System Status
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="p-0">
          <a href="/privacy" className="flex items-center gap-1.5 w-full h-full px-3 py-2 text-inherit decoration-none">
            <BookOpen className="w-3.5 h-3.5" /> Privacy Policy
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="p-0">
          <a href="/legal" className="flex items-center gap-1.5 w-full h-full px-3 py-2 text-inherit decoration-none">
            <BookOpen className="w-3.5 h-3.5" /> Legal Notice
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Auth status & actions */}
        {user ? (
          <>
            <DropdownMenuLabel>Account ({user.email.split("@")[0]})</DropdownMenuLabel>
            <DropdownMenuItem className="p-0">
              <a href="/dashboard" className="flex items-center gap-1.5 w-full h-full px-3 py-2 text-inherit decoration-none">
                <UserIcon className="w-3.5 h-3.5" /> Dashboard
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem className="p-0">
              <a href={`/login?redirect=${encodeURIComponent(pathname)}`} className="flex items-center gap-1.5 w-full h-full px-3 py-2 text-inherit decoration-none">
                <LogIn className="w-3.5 h-3.5" /> Login
              </a>
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
