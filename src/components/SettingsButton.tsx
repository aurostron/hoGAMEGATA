"use client";

import { useState, useEffect } from "react";
import { MoreVertical, BookOpen, Sliders, Layout, LogIn, LogOut, User as UserIcon } from "lucide-react";
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

    window.addEventListener("gata-mobile-layout-changed", handleLayoutChange);
    return () => window.removeEventListener("gata-mobile-layout-changed", handleLayoutChange);
  }, []);

  const toggleLayout = (newLayout: "grid" | "list") => {
    localStorage.setItem("gata-mobile-layout", newLayout);
    setLayout(newLayout);
    window.dispatchEvent(new Event("gata-mobile-layout-changed"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <button data-tour="options-button" className="flex items-center justify-center font-mono text-xs text-white hover:bg-white hover:text-black transition-all duration-150 border border-transparent hover:border-white w-11 h-11 sm:w-12 sm:h-12 rounded-none font-bold cursor-pointer bg-black" title="More Options">
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

        {/* Preferences */}
        <DropdownMenuLabel>Personalize</DropdownMenuLabel>
        <DropdownMenuItem onClick={openModal} className="flex items-center gap-1.5 cursor-pointer">
          <Sliders className="w-3.5 h-3.5" /> Preferences
        </DropdownMenuItem>

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
