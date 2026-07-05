"use client";

interface NyanLoaderProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export default function NyanLoader({ 
  message = "SCANNING VIBE MATRIX...", 
  fullScreen = false,
  className = ""
}: NyanLoaderProps) {
  const containerClasses = fullScreen
    ? `fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md gap-8 ${className}`
    : `flex flex-col items-center justify-center py-16 gap-6 w-full ${className}`;

  const gifSize = fullScreen ? { width: 400, height: 240 } : { width: 160, height: 96 };
  const textSize = fullScreen ? "text-xl md:text-2xl" : "text-xs";

  return (
    <div className={containerClasses}>
      {/* Nyan Cat GIF (no background track or borders) */}
      <div className="relative flex items-center justify-center select-none pointer-events-none">
        <img
          src="/nyan-cat.gif"
          alt="Nyan Cat Loading..."
          width={gifSize.width}
          height={gifSize.height}
          className={`object-contain ${fullScreen ? "-translate-x-[10%] md:-translate-x-[14%]" : ""}`}
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      
      {/* Blinking Message */}
      <div className={`font-mono text-white uppercase tracking-[0.2em] font-black animate-pulse text-center ${textSize}`}>
        {message}
      </div>
    </div>
  );
}
