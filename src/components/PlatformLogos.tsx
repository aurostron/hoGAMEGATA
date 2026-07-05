"use client";

import React from "react";

interface Platform {
  name: string;
  slug: string;
}

interface PlatformLogosProps {
  platforms?: Platform[];
  platformNames?: string | null;
  className?: string;
  solid?: boolean;
}

export default function PlatformLogos({
  platforms,
  platformNames,
  className = "flex items-center gap-2.5 transition-colors",
  solid = false
}: PlatformLogosProps) {
  
  const lowerNames = platformNames?.toLowerCase() || "";

  // Find which icons are needed based on matching string content in names/slugs
  const showPC = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("win") || s.includes("pc") || n.includes("windows") || n.includes("pc");
  })) || lowerNames.includes("win") || lowerNames.includes("pc") || lowerNames.includes("windows");
  
  const showPlaystation = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("playstation") || s.includes("ps") || n.includes("playstation") || n.includes("ps");
  })) || lowerNames.includes("playstation") || lowerNames.includes("ps");

  const showXbox = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("xbox") || n.includes("xbox");
  })) || lowerNames.includes("xbox");

  const showNintendo = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("switch") || s.includes("nintendo") || n.includes("switch") || n.includes("nintendo");
  })) || lowerNames.includes("switch") || lowerNames.includes("nintendo");

  const showMac = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("mac") || s.includes("osx") || s.includes("os-x") || n.includes("macos") || n.includes("mac");
  })) || lowerNames.includes("mac") || lowerNames.includes("osx") || lowerNames.includes("os-x") || lowerNames.includes("macos");

  const showLinux = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("linux") || n.includes("linux");
  })) || lowerNames.includes("linux");

  const showAndroid = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("android") || n.includes("android");
  })) || lowerNames.includes("android");

  const showIOS = (platforms && platforms.some(p => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("ios") || s.includes("ipad") || s.includes("iphone") || n.includes("ios") || n.includes("ipad") || n.includes("iphone");
  })) || lowerNames.includes("ios") || lowerNames.includes("ipad") || lowerNames.includes("iphone");

  // Grid cards and List rows both flip logos to black on group-hover to match the white card hover state
  const opacityClass = solid ? "opacity-70" : "opacity-50";
  const imgClass = `w-4 h-4 shrink-0 filter brightness-0 invert ${opacityClass} group-hover:invert-0 group-hover:opacity-75 transition-all duration-150 select-none`;

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
      {showIOS && (
        <img
          src="/platforms/apple.svg"
          alt="iOS / iPadOS"
          title="iOS / iPadOS"
          className={imgClass}
        />
      )}
      {showAndroid && (
        <img
          src="/platforms/android.svg"
          alt="Android"
          title="Android"
          className={imgClass}
        />
      )}
    </div>
  );
}
