"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings, BookOpen, Sliders, Layout, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";

export default function SettingsButton() {
  const { user, logout } = useAuth();
  const { openModal } = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  // Sync layout from localStorage on mount and listen to changes
  useEffect(() => {
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
        <button className="flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold cursor-pointer bg-black" title="Settings">
          <Settings className="w-3.5 h-3.5" />
          <span>[ Options ]</span>
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
        <DropdownMenuItem onClick={openModal} className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" /> Preferences
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Technical Docs */}
        <DropdownMenuLabel>Resources</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => router.push("/docs")} className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Technical Docs
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Auth status & actions */}
        {user ? (
          <>
            <DropdownMenuLabel>Account ({user.email.split("@")[0]})</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push(`/login?redirect=${encodeURIComponent(pathname)}`)} className="flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> Login
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
