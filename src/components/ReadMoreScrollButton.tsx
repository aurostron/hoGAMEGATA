"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export default function ReadMoreScrollButton() {
  const scrollToDetails = () => {
    const target = document.getElementById("details-overview-section");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollBy({ top: 450, behavior: "smooth" });
    }
  };

  return (
    <button
      onClick={scrollToDetails}
      className="w-full text-white/50 hover:text-white transition-all duration-200 font-light font-sans"
      title="Scroll to game overview & media"
    >
      <span className="tracking-widest uppercase text-[22px]">Read more...</span>
      <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform duration-200 opacity-80 group-hover:opacity-100" />
    </button>
  );
}
