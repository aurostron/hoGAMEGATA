"use client";

import { ArrowLeft } from "lucide-react";

export default function ReturnButton() {
  const handleReturn = () => {
    if (
      typeof window !== "undefined" &&
      document.referrer &&
      document.referrer.includes(window.location.host)
    ) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  };

  return (
    <button
      onClick={handleReturn}
      className="group flex items-center gap-2 font-mono text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-white/20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] px-5 py-2.5 rounded-full font-bold uppercase tracking-wider active:scale-[0.97] cursor-pointer select-none"
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]" />
      <span>Return to Search</span>
    </button>
  );
}
