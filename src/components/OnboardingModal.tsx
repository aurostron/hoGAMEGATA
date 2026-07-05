"use client";

import { useState, useEffect } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { TAXONOMY_GROUPS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { useAuth, AuthProvider } from "@/context/AuthContext";

function OnboardingModalInner() {
  const [pathname, setPathname] = useState("");
  const { user, loading: authLoading } = useAuth();
  const { hasOnboarded, isLoaded, isModalOpen, vibes: existingVibes, completeOnboarding } = usePreferences();

  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [greeting, setGreeting] = useState("Good day");

  const totalSteps = TAXONOMY_GROUPS.length + 1;

  // Sync pathname on mount
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      if (existingVibes.length > 0) {
        setSelectedVibes(existingVibes);
      }
      if (hasOnboarded) {
        setStep(totalSteps);
      } else {
        setStep(0);
      }
    }
  }, [isModalOpen, existingVibes, hasOnboarded, totalSteps]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Block rendering on excluded pages or if not loaded/open
  if (authLoading || ["/waitlist", "/login", "/auth/callback"].includes(pathname)) {
    return null;
  }

  if (!isLoaded || !isModalOpen) return null;

  const handleNext = () => {
    setIsFading(true);
    setTimeout(() => {
      setStep(prev => Math.min(prev + 1, totalSteps));
      setIsFading(false);
    }, 250);
  };

  const handleBack = () => {
    setIsFading(true);
    setTimeout(() => {
      setStep(prev => Math.max(prev - 1, 0));
      setIsFading(false);
    }, 250);
  };

  const handleSkip = () => {
    completeOnboarding(selectedVibes);
  };

  const getCategoryForVibe = (slug: string) => {
    return TAXONOMY_GROUPS.find(group =>
      group.filters.some(f => f.slug === slug)
    );
  };

  const toggleVibe = (slug: string) => {
    if (selectedVibes.includes(slug)) {
      setSelectedVibes(selectedVibes.filter(v => v !== slug));
    } else {
      const group = getCategoryForVibe(slug);
      if (group) {
        const groupSlugs = group.filters.map(f => f.slug);
        const countInGroup = selectedVibes.filter(v => groupSlugs.includes(v)).length;
        if (countInGroup < 5) {
          setSelectedVibes([...selectedVibes, slug]);
        }
      }
    }
  };

  return (
    // Ethereal Glass / Dark Tech Layout (Visible semi-transparent bg, no blur)
    <div className="fixed inset-0 z-50 bg-black/65 flex flex-col justify-between overflow-y-auto select-none font-sans antialiased">
      
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-white/4 blur-[100px] sm:blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] sm:w-[600px] h-[450px] sm:h-[600px] rounded-full bg-blue-500/5 blur-[120px] sm:blur-[150px] pointer-events-none" />

      {/* Main card body */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
        <div
          className={cn(
            "w-full max-w-2xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isFading ? "opacity-0 translate-y-4 scale-98" : "opacity-100 translate-y-0 scale-100"
          )}
        >
          
          {/* Double-Bezel Card Container */}
          <div className="relative rounded-[2rem] p-1.5 bg-white/5 border border-white/10 shadow-2xl">
            
            {/* Close / Skip Action (brought near/onto the modal card) */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 font-mono text-[9.5px] sm:text-[10px] font-bold tracking-[0.25em] uppercase text-white/40 hover:text-white transition-colors duration-250 cursor-pointer flex items-center gap-1.5 py-1 px-2.5 rounded-md hover:bg-white/5 active:scale-95"
            >
              {hasOnboarded ? (
                <>
                  Close <span className="text-white/60">✕</span>
                </>
              ) : (
                <>
                  Skip <span className="text-white/60">↗</span>
                </>
              )}
            </button>

            <div className="rounded-[calc(2rem-0.375rem)] pt-12 pb-6 px-6 sm:pt-14 sm:pb-10 sm:px-10 bg-black/80 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col gap-8">
              
              {/* Stepper progress indicator (steps 1 to totalSteps - 1) */}
              {step > 0 && step < totalSteps && (
                <div className="flex items-center gap-1.5 w-full select-none">
                  {Array.from({ length: TAXONOMY_GROUPS.length }).map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                        idx < step
                          ? "bg-white"
                          : idx === step - 1
                          ? "bg-white/60"
                          : "bg-white/10"
                      )}
                    />
                  ))}
                </div>
              )}

              {/* ── Step 0: Welcome / Intro ─────────────────────────────────── */}
              {step === 0 && (
                <div className="flex flex-col items-center text-center gap-7 py-4 sm:py-8">
                  <div className="space-y-4 max-w-lg">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none text-white">
                      {greeting},
                    </h1>
                    <h2 className="text-base sm:text-lg font-medium text-white/60 leading-relaxed max-w-md mx-auto">
                      Let&apos;s build a curated discovery feed matching your horror taste.
                    </h2>
                  </div>

                  <div className="w-12 h-px bg-white/10" />

                  <p className="text-m text-white/40 font-regular">
                    Takes less than a minute
                  </p>

                  <button
                    onClick={handleNext}
                    className="group rounded-full pl-6 pr-3 py-2.5 bg-white text-black text-m font-bold flex items-center justify-between gap-4 hover:bg-white/95 active:scale-[0.98] transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    <span>Start Curation</span>
                    <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center font-sans group-hover:translate-x-0.5 transition-transform duration-300 font-black text-xs leading-none">
                      →
                    </span>
                  </button>

                  <p className="text-[15px] text-white/45 leading-relaxed max-w-xs mt-1">
                    You can always update this preference later in the options dropdown menu.
                  </p>
                </div>
              )}

              {/* ── Steps 1–N: Category Questions ────────────────────── */}
              {(() => {
                if (step <= 0 || step > TAXONOMY_GROUPS.length) return null;
                const currentGroup = TAXONOMY_GROUPS[step - 1];
                const currentGroupSlugs = currentGroup.filters.map(f => f.slug);
                const selectedInCurrentGroup = selectedVibes.filter(v => currentGroupSlugs.includes(v));
                const isCurrentStepMaxReached = selectedInCurrentGroup.length >= 5;

                return (
                  <div className="flex flex-col gap-8">
                    {/* Header */}
                    <div className="space-y-1.5">
                      <p className="text-white/40 font-mono text-[10px] tracking-widest uppercase">
                        Category {step} of {TAXONOMY_GROUPS.length}
                      </p>
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                        What {currentGroup.categoryName} do you like?
                      </h1>
                    </div>

                    {/* Vibe selection pills */}
                    <div className="flex flex-wrap gap-2 sm:gap-2.5 max-h-[250px] overflow-y-auto pr-1">
                      {currentGroup.filters.map((filter) => {
                        const isSelected = selectedVibes.includes(filter.slug);
                        const isDisabled = isCurrentStepMaxReached && !isSelected;
                        return (
                          <button
                            key={filter.slug}
                            onClick={() => toggleVibe(filter.slug)}
                            disabled={isDisabled}
                            className={cn(
                              "rounded-full px-4 py-2 border text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96] cursor-pointer",
                              isSelected
                                ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:bg-white/90"
                                : "bg-white/5 text-white/75 border-white/10 hover:border-white/35 hover:bg-white/10 hover:text-white",
                              isDisabled && "opacity-20 cursor-not-allowed pointer-events-none border-white/5 bg-transparent"
                            )}
                          >
                            {filter.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Stepper controls */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 gap-4">
                      {/* Counter */}
                      <div className="font-mono text-[11px] text-white/50 tracking-widest uppercase flex items-center gap-2">
                        Selected:
                        <span className={cn(
                          "font-bold px-2 py-0.5 border rounded-md",
                          selectedInCurrentGroup.length > 0 ? "text-white border-white/20 bg-white/5" : "text-white/30 border-white/5"
                        )}>
                          {selectedInCurrentGroup.length} / 5
                        </span>
                      </div>

                      {/* Nav controls */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleBack}
                          className="rounded-full px-5 py-2 border border-white/10 text-white/60 text-xs font-bold hover:border-white/35 hover:text-white transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 cursor-pointer active:scale-95"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleNext}
                          className="group rounded-full pl-5 pr-2 py-1.5 bg-white text-black text-xs font-bold flex items-center gap-2.5 hover:bg-white/90 active:scale-[0.97] transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        >
                          <span>Next</span>
                          <span className="w-4.5 h-4.5 rounded-full bg-black/5 flex items-center justify-center font-sans group-hover:translate-x-0.5 transition-transform duration-300 font-black text-[9px] leading-none">
                            →
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Final Step: Review ───────────────────────────────── */}
              {step === totalSteps && (
                <div className="flex flex-col gap-6 sm:gap-8">
                  {/* Header */}
                  <div className="space-y-1.5">
                    <p className="text-white/40 font-mono text-[10px] tracking-widest uppercase">Overview</p>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Review Your Picks</h1>
                    <p className="text-white/50 text-xs leading-relaxed pt-1 max-w-xl">
                      These will tune your discovery feed. You can select up to 5 items in each category.
                    </p>
                  </div>

                  {/* Summary list */}
                  <div className="space-y-5 max-h-[300px] overflow-y-auto pr-1">
                    {TAXONOMY_GROUPS.map((group) => {
                      const groupSlugs = group.filters.map(f => f.slug);
                      const selectedInGroup = selectedVibes.filter(v => groupSlugs.includes(v));
                      const isGroupMaxReached = selectedInGroup.length >= 5;

                      return (
                        <div key={group.categorySlug} className="space-y-2 border-b border-white/5 pb-4 last:border-b-0 last:pb-0">
                          <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/40 flex items-center justify-between">
                            <span>{group.categoryName}</span>
                            <span className="text-[10px] text-white/50">({selectedInGroup.length}/5)</span>
                          </h2>
                          <div className="flex flex-wrap gap-2">
                            {group.filters.map((filter) => {
                              const isSelected = selectedVibes.includes(filter.slug);
                              const isDisabled = isGroupMaxReached && !isSelected;
                              return (
                                <button
                                  key={filter.slug}
                                  onClick={() => toggleVibe(filter.slug)}
                                  disabled={isDisabled}
                                  className={cn(
                                    "rounded-full px-3 py-1.5 border text-[11px] font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 cursor-pointer",
                                    isSelected
                                      ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)] hover:bg-white/90"
                                      : "bg-white/5 text-white/55 border-white/5 hover:border-white/20 hover:bg-white/10 hover:text-white",
                                    isDisabled && "opacity-15 cursor-not-allowed pointer-events-none border-white/5 bg-transparent"
                                  )}
                                >
                                  {filter.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions bar */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-white/15">
                    <div className="font-mono text-xs tracking-widest uppercase flex items-center gap-2">
                      <span className="text-white/40">Total Selected:</span>
                      <span className={cn(
                        "font-bold px-2.5 py-0.5 border rounded-md",
                        selectedVibes.length > 0 ? "text-white border-white/20 bg-white/5" : "text-white/30 border-white/5"
                      )}>
                        {selectedVibes.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleBack}
                        className="rounded-full px-5 py-2.5 border border-white/10 text-white/60 text-xs font-bold hover:border-white/35 hover:text-white transition-all ease-[cubic-bezier(0.32,0.72,0,1)] duration-300 cursor-pointer w-full sm:w-auto active:scale-95"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => completeOnboarding(selectedVibes)}
                        disabled={selectedVibes.length === 0}
                        className={cn(
                          "group rounded-full pl-6 pr-3 py-2.5 text-xs font-bold flex items-center justify-between gap-3 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer w-full sm:w-auto",
                          selectedVibes.length > 0
                            ? "bg-white border border-white text-black hover:bg-white/90 active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                            : "bg-white/5 border border-white/5 text-white/20 cursor-not-allowed"
                        )}
                      >
                        <span>{hasOnboarded ? "Update Feed" : "Build Feed"}</span>
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center font-sans group-hover:translate-x-0.5 transition-transform duration-300 font-black text-[9px] leading-none",
                          selectedVibes.length > 0 ? "bg-black/5 text-black" : "bg-white/10 text-white/20"
                        )}>
                          →
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer minimal info */}
      <footer className="relative z-10 w-full px-6 py-4 text-center shrink-0 border-t border-white/5 bg-black/10 select-none">
        <p className="font-mono text-[8px] text-white/20 uppercase tracking-[0.2em]">
          Powered by GAMEGATA curation intelligence · v1.2.0
        </p>
      </footer>
    </div>
  );
}

export default function OnboardingModal() {
  return (
    <AuthProvider>
      <OnboardingModalInner />
    </AuthProvider>
  );
}
