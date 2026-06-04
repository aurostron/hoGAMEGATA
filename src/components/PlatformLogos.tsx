"use client";

import React from "react";

interface Platform {
  name: string;
  slug: string;
}

interface PlatformLogosProps {
  platforms: Platform[];
  className?: string;
  solid?: boolean;
}

export default function PlatformLogos({
  platforms,
  className = "flex items-center gap-2.5 transition-colors",
  solid = false
}: PlatformLogosProps) {
  
  // Find which icons are needed based on matching string content in names/slugs
  const showPC = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("win") || s.includes("pc") || n.includes("windows") || n.includes("pc");
  });
  
  const showPlaystation = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("playstation") || s.includes("ps") || n.includes("playstation") || n.includes("ps");
  });

  const showXbox = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("xbox") || n.includes("xbox");
  });

  const showNintendo = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("switch") || s.includes("nintendo") || n.includes("switch") || n.includes("nintendo");
  });

  const showMac = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("mac") || s.includes("osx") || s.includes("os-x") || n.includes("macos") || n.includes("mac");
  });

  const showLinux = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("linux") || n.includes("linux");
  });

  const showMobile = platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("android") || s.includes("ios") || s.includes("phone") || n.includes("android") || n.includes("ios");
  });

  // filter: brightness(0) invert(1) makes the SVG completely solid white.
  // When card is hovered (group), we cancel invert (invert-0), making it solid black.
  // Opacity controls the grayscale intensity.
  const opacityClass = solid ? "opacity-100" : "opacity-50";
  const imgClass = `w-3.5 h-3.5 shrink-0 filter brightness-0 invert ${opacityClass} group-hover:invert-0 group-hover:opacity-75 transition-all duration-150 select-none`;

  return (
    <div className={className}>
      {showPC && (
        <img
          src="/platforms/windows.svg"
          alt="PC (Windows)"
          title="PC (Windows)"
          className={imgClass}
        />
      )}
      {showPlaystation && (
        <img
          src="/platforms/playstation.svg"
          alt="PlayStation"
          title="PlayStation"
          className={imgClass}
        />
      )}
      {showXbox && (
        <img
          src="/platforms/xbox.svg"
          alt="Xbox"
          title="Xbox"
          className={imgClass}
        />
      )}
      {showNintendo && (
        <img
          src="/platforms/nintendo.svg"
          alt="Nintendo Switch"
          title="Nintendo Switch"
          className={imgClass}
        />
      )}
      {showMac && (
        <img
          src="/platforms/apple.svg"
          alt="macOS"
          title="macOS"
          className={imgClass}
        />
      )}
      {showLinux && (
        <img
          src="/platforms/linux.svg"
          alt="Linux"
          title="Linux"
          className={imgClass}
        />
      )}
      {showMobile && (
        <img
          src="/platforms/android.svg"
          alt="Mobile"
          title="Mobile"
          className={imgClass}
        />
      )}
    </div>
  );
}
