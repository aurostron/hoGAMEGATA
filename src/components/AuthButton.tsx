"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { User, LogOut, LogIn } from "lucide-react";

export default function AuthButton() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <span className="font-mono text-xs text-white/50 animate-pulse font-bold uppercase tracking-wider px-3 py-1.5">
        [ ... ]
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(pathname)}`}
        className="group flex items-center gap-1.5 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>[ Login ]</span>
      </Link>
    );
  }

  const emailPrefix = user.email.split("@")[0];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Dashboard Link */}
      <Link
        href="/dashboard"
        className="group flex items-center gap-1.5 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
      >
        <User className="w-3.5 h-3.5" />
        <span>[ Dashboard: {emailPrefix} ]</span>
      </Link>

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
