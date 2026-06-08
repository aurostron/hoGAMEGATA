"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TourStep {
  targetSelector: string | null; // null means centered modal
  title: string;
  description: string;
  placement: "bottom" | "top" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: null,
    title: "Welcome to hoGAMEGATA",
    description: "This is your portal to the most curated database of horror games. Let's take a quick 1-minute tour to help you navigate through the darkness.",
    placement: "center"
  },
  {
    targetSelector: '[data-tour="search-bar"]',
    title: "Find Games",
    description: "Start searching for games by using this search bar. You can look up games by title, developer name, genre, or specific horror style tags.",
    placement: "bottom"
  },
  {
    targetSelector: '[data-tour="game-card"]',
    title: "Game details & prices",
    description: "Click on any game card to check real-time price deals across stores, view screenshots, read details, and save games to your personal collection.",
    placement: "top"
  },
  {
    targetSelector: '[data-tour="options-button"]',
    title: "More options",
    description: "Use this menu to switch between list and grid views, adjust your personalization preferences, check the system status page, or restart this guide anytime.",
    placement: "bottom"
  }
];

export default function InteractiveTutorial() {
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tour if user navigates away from the home page
  useEffect(() => {
    if (pathname !== "/") {
      setIsActive(false);
    }
  }, [pathname]);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync body class with tour state to freeze scrolling
  useEffect(() => {
    if (isActive) {
      document.body.classList.add("tutorial-active");
    } else {
      document.body.classList.remove("tutorial-active");
    }
    return () => {
      document.body.classList.remove("tutorial-active");
    };
  }, [isActive]);

  const calculatePositions = useCallback(() => {
    if (!isActive) return;
    
    const step = TOUR_STEPS[stepIndex];
    if (!step.targetSelector) {
      setSpotlightStyle({ display: "none" });
      setTooltipStyle({});
      return;
    }

    const element = document.querySelector(step.targetSelector) as HTMLElement;
    if (!element) {
      // Element not present in DOM yet, fall back to center layout
      setSpotlightStyle({ display: "none" });
      setTooltipStyle({});
      return;
    }

    // Scroll target element into view
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    // Calculate dimensions
    const rect = element.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const top = rect.top + scrollY;
    const left = rect.left + scrollX;
    const width = rect.width;
    const height = rect.height;

    // Set spotlight border box around target element with butter-smooth animation
    setSpotlightStyle({
      top: `${top - 4}px`,
      left: `${left - 4}px`,
      width: `${width + 8}px`,
      height: `${height + 8}px`,
      display: "block",
      position: "absolute",
      zIndex: 99999,
      pointerEvents: "none",
      transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
    });

    // Handle tooltip positioning with butter-smooth animation
    if (isMobile) {
      // On mobile, render as a clean bottom bar card
      setTooltipStyle({
        position: "fixed",
        bottom: "24px",
        left: "16px",
        right: "16px",
        zIndex: 100000,
        transform: "none",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
      });
      return;
    }

    // On desktop, calculate relative positioning to the spotlight
    let tooltipTop = 0;
    let tooltipLeft = left + width / 2;

    if (step.placement === "bottom") {
      tooltipTop = top + height + 16;
      setTooltipStyle({
        position: "absolute",
        top: `${tooltipTop}px`,
        left: `${tooltipLeft}px`,
        transform: "translateX(-50%)",
        zIndex: 100000,
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
      });
    } else if (step.placement === "top") {
      tooltipTop = top - 16;
      setTooltipStyle({
        position: "absolute",
        top: `${tooltipTop}px`,
        left: `${tooltipLeft}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 100000,
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
      });
    }
  }, [isActive, stepIndex, isMobile]);

  // Recalculate coordinates on window resize or scroll
  useEffect(() => {
    if (isActive) {
      calculatePositions();
      window.addEventListener("resize", calculatePositions);
      window.addEventListener("scroll", calculatePositions);
    }
    return () => {
      window.removeEventListener("resize", calculatePositions);
      window.removeEventListener("scroll", calculatePositions);
    };
  }, [isActive, stepIndex, calculatePositions]);

  // Trigger calculations on step changes
  useEffect(() => {
    if (isActive) {
      // Small timeout to allow element.scrollIntoView to trigger and layout to settle
      const timer = setTimeout(calculatePositions, 100);
      return () => clearTimeout(timer);
    }
  }, [stepIndex, isActive, calculatePositions]);

  // Listen to start tutorial event
  useEffect(() => {
    const handleStartTutorial = () => {
      setStepIndex(0);
      setIsActive(true);
    };

    window.addEventListener("gamegata_start_tutorial", handleStartTutorial);
    
    // Auto start check on mount for first-time users
    const hasCompleted = localStorage.getItem("gamegata_tutorial_completed");
    const hasOnboarded = localStorage.getItem("gamegata_onboarded");
    
    if (hasOnboarded === "true" && hasCompleted !== "true" && pathname === "/") {
      // Run auto tour shortly after onboarding modal closes
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("gamegata_start_tutorial", handleStartTutorial);
    };
  }, [pathname]);

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    setStepIndex(prev => Math.max(0, prev - 1));
  };

  const handleComplete = () => {
    setIsActive(false);
    localStorage.setItem("gamegata_tutorial_completed", "true");
  };

  if (!isActive) return null;

  const currentStep = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Dimmed backdrop blocking mouse interactions */}
      <div 
        className="fixed inset-0 bg-black/60 z-[99998] transition-opacity duration-300 pointer-events-auto"
        onClick={handleComplete}
      />

      {/* Spotlight focus box */}
      {currentStep.targetSelector && (
        <div 
          style={spotlightStyle}
          className="border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.7)] bg-white/5"
        />
      )}

      {/* Tooltip Card */}
      <div 
        ref={tooltipRef}
        style={tooltipStyle}
        className={cn(
          "bg-black border-2 border-white p-6 md:p-8 flex flex-col gap-5 max-w-sm w-full",
          currentStep.placement === "center" && "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100000] max-w-md shadow-[8px_8px_0px_0px_#ffffff]"
        )}
      >
        <div className="space-y-2 select-none">
          <div className="flex justify-between items-center border-b border-white/20 pb-2.5">
            <span className="font-mono text-[10px] text-white font-bold tracking-widest uppercase">
              {currentStep.targetSelector ? `Step ${stepIndex} / ${TOUR_STEPS.length - 1}` : "Welcome"}
            </span>
            {!isFirst && (
              <button 
                onClick={handleComplete}
                className="font-mono text-[9px] text-white/55 hover:text-white uppercase tracking-wider transition-colors duration-150 cursor-pointer"
              >
                [ Skip ]
              </button>
            )}
          </div>
          
          <h3 className="font-sans font-black text-xl uppercase tracking-tight text-white leading-tight mt-1">
            {currentStep.title}
          </h3>
          
          <p className="font-sans font-medium text-xs text-white/70 leading-relaxed pt-1">
            {currentStep.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex justify-between items-center gap-4 font-mono text-xs pt-1.5 border-t border-white/10 select-none">
          {isFirst ? (
            <>
              <button
                onClick={handleComplete}
                className="px-4 py-2 hover:bg-white/10 text-white/70 hover:text-white transition-colors duration-150 uppercase tracking-wider font-bold cursor-pointer"
              >
                Skip Guide
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-white text-black hover:bg-transparent hover:text-white transition-all duration-150 border border-white font-black uppercase tracking-wider cursor-pointer"
              >
                Start Tour →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-white/60 hover:text-white transition-colors duration-150 uppercase tracking-wider font-bold cursor-pointer border border-transparent hover:border-white/25"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-white text-black hover:bg-transparent hover:text-white transition-all duration-150 border border-white font-black uppercase tracking-wider cursor-pointer"
              >
                {isLast ? "Finish Tour" : "Next Step →"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
