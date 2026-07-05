"use client";

import { useState, useEffect } from "react";
import { getYoutubeId } from "../lib/utils";

interface HoverTrailerProps {
  trailerUrl?: string | null;
  coverUrl?: string | null;
  altText?: string;
  aspectClass?: string;
}

export default function HoverTrailer({
  trailerUrl,
  coverUrl,
  altText = "Game preview",
  aspectClass = "w-full h-full"
}: HoverTrailerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (isHovered && trailerUrl) {
      const timer = setTimeout(() => {
        setShowVideo(true);
      }, 380); // 380ms delay to prevent quick mouse swipes from loading trailers
      return () => clearTimeout(timer);
    } else {
      setShowVideo(false);
    }
  }, [isHovered, trailerUrl]);

  const ytId = getYoutubeId(trailerUrl);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden shrink-0 flex items-center justify-center ${aspectClass}`}
    >
      {/* Fallback Cover Image */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={altText}
          className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-b from-white/10 to-black flex items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">No Preview</span>
        </div>
      )}

      {/* Embedded iframe YouTube Video on Hover */}
      {showVideo && ytId && (
        <div className="absolute inset-0 z-10 w-full h-full bg-black select-none pointer-events-none overflow-hidden">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none overflow-hidden"
            style={{
              height: "220%",
              aspectRatio: "16 / 9",
              width: "auto"
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`}
              className="w-full h-full pointer-events-none border-0"
              allow="autoplay; encrypted-media"
              frameBorder="0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
