"use client";

import Image from "next/image";

interface NyanLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export default function NyanLoader({ 
  message = "SCANNING VIBE MATRIX...", 
  fullScreen = false 
}: NyanLoaderProps) {
  const containerClasses = fullScreen
    ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md"
    : "flex flex-col items-center justify-center py-16 gap-6 w-full border-4 border-white bg-black p-8 shadow-[8px_8px_0px_0px_#ffffff]";

  const content = (
    <>
      {/* Animated Rainbow Track */}
      <div className="relative flex items-center justify-center overflow-hidden w-full max-w-md h-24 border border-white/20 bg-neutral-950 p-2">
        {/* Repeating Rainbow Background */}
        <div 
          className="absolute left-0 right-16 top-1/2 -translate-y-1/2 h-8 opacity-80" 
          style={{
            backgroundImage: "linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff)",
            backgroundSize: "200% 100%",
            animation: "rainbow-slide 2s linear infinite"
          }}
        />
        
        {/* Nyan Cat GIF Wrapper */}
        <div className="absolute right-4 w-20 h-12 flex items-center justify-center z-10">
          <Image
            src="/nyan-cat.gif"
            alt="Nyan Cat Loading..."
            width={80}
            height={48}
            className="object-contain select-none pointer-events-none"
            unoptimized
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>
      
      {/* Blinking Message */}
      <div className="font-mono text-xs text-white uppercase tracking-[0.2em] font-black animate-pulse text-center">
        [ {message} ]
      </div>

      <style jsx global>{`
        @keyframes rainbow-slide {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
      `}</style>
    </>
  );

  if (fullScreen) {
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center justify-center border-4 border-white bg-black p-8 shadow-[8px_8px_0px_0px_#ffffff] max-w-md w-full mx-4 gap-6">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {content}
    </div>
  );
}

