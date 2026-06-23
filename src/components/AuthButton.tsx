"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { User, LogOut, LogIn } from "lucide-react";

function AuthButtonInner() {
  const { user, loading, logout } = useAuth();
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPathname(window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <span className="font-mono text-xs text-white/50 animate-pulse font-bold uppercase tracking-wider px-3 py-1.5">
        [ ... ]
      </span>
    );
  }

  if (!user) {
    return (
      <a
        href={`/login?redirect=${encodeURIComponent(pathname)}`}
        className="group flex items-center gap-1.5 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>[ Login ]</span>
      </a>
    );
  }

  const emailPrefix = user.email.split("@")[0];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Dashboard Link */}
      <a
        href="/dashboard"
        className="group flex items-center gap-1.5 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
      >
        <User className="w-3.5 h-3.5" />
        <span>[ Dashboard: {emailPrefix} ]</span>
      </a>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="group flex items-center gap-1.5 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>[ Logout ]</span>
      </button>
    </div>
  );
}

export default function AuthButton() {
  return (
    <AuthProvider>
      <AuthButtonInner />
    </AuthProvider>
  );
}
