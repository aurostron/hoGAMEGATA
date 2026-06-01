"use client";

import { useState, useEffect } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { TAXONOMY_GROUPS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export default function OnboardingModal() {
  const { hasOnboarded, isLoaded, isModalOpen, vibes: existingVibes, completeOnboarding } = usePreferences();
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  const [step, setStep] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [greeting, setGreeting] = useState("Good day");

  const totalSteps = TAXONOMY_GROUPS.length + 1;

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

  // Progress bar width (step 0 = 0%, step N = 100%)
  const progressPct = step === 0 ? 0 : Math.round((step / totalSteps) * 100);

  return (
    // Overlay — solid dark, blocks everything behind it
    <div className="fixed inset-0 z-50 bg-[#080808] flex flex-col overflow-y-auto">

      {/* Top progress bar */}
      <div className="w-full h-0.5 bg-white/10 shrink-0">
        <div
          className="h-full bg-white transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div
          className={cn(
            "w-full max-w-2xl transition-all duration-300 ease-in-out",
            isFading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          )}
        >

          {/* ── Step 0: Greeting ─────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-8">
              {/* Eyebrow */}
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40 border border-white/15 px-3 py-1">
                hoGAMEGATA — First Time Setup
              </span>

              {/* Greeting */}
              <div className="space-y-3">
                <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight text-white">
                  {greeting},
                </h1>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white/70">
                  Let&apos;s build a curated feed just for you.
                </h2>
              </div>

              {/* Separator */}
              <div className="w-16 h-px bg-white/20" />

              {/* Time badge */}
              <p className="font-mono text-xs tracking-widest uppercase text-white/50">
                Takes about 2 minutes
              </p>

              {/* CTA */}
              <button
                onClick={handleNext}
                className="mt-2 px-14 py-4 font-mono font-black text-sm tracking-widest uppercase bg-white text-black border border-white hover:bg-transparent hover:text-white transition-all duration-200"
              >
                START →
              </button>

              <p className="font-mono text-[9px] text-white/25 uppercase tracking-widest">
                You can always update this later via [ Preferences ] in the footer
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
              <div className="flex flex-col gap-10">
                {/* Step header */}
                <div className="border-l-2 border-white pl-5 space-y-1.5">
                  <p className="text-white/40 font-mono text-[10px] tracking-widest uppercase">
                    Step {step} of {TAXONOMY_GROUPS.length}
                  </p>
                  <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight">
                    What {currentGroup.categoryName} do you like?
                  </h1>
                </div>

                {/* Tag grid */}
                <div className="flex flex-wrap gap-2.5">
                  {currentGroup.filters.map((filter) => {
                    const isSelected = selectedVibes.includes(filter.slug);
                    const isDisabled = isCurrentStepMaxReached && !isSelected;
                    return (
                      <button
                        key={filter.slug}
                        onClick={() => toggleVibe(filter.slug)}
                        disabled={isDisabled}
                        className={cn(
                          "px-4 py-2.5 border text-xs font-mono font-bold uppercase tracking-wider transition-all duration-150 rounded-none",
                          isSelected
                            ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.25)]"
                            : "bg-transparent text-white border-white/35 hover:border-white hover:bg-white/5",
                          isDisabled && "opacity-25 cursor-not-allowed pointer-events-none"
                        )}
                      >
                        {filter.name}
                      </button>
                    );
                  })}
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  {/* Selection counter */}
                  <div className="font-mono text-xs text-white/50 tracking-widest uppercase flex items-center gap-2">
                    Selected:
                    <span className={cn(
                      "font-black px-2 py-0.5 border",
                      selectedInCurrentGroup.length > 0 ? "text-white border-white/40 bg-white/10" : "text-white/30 border-white/10"
                    )}>
                      {selectedInCurrentGroup.length} / 5
                    </span>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBack}
                      className="px-5 py-2.5 font-mono font-bold text-xs tracking-widest uppercase text-white/60 border border-white/25 hover:border-white hover:text-white transition-all duration-150"
                    >
                      ← BACK
                    </button>
                    <button
                      onClick={handleNext}
                      className="px-7 py-2.5 font-mono font-black text-xs tracking-widest uppercase bg-white text-black border border-white hover:bg-transparent hover:text-white transition-all duration-150"
                    >
                      NEXT →
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Final Step: Review ───────────────────────────────── */}
          {step === totalSteps && (
            <div className="flex flex-col gap-8">

              {/* Header */}
              <div className="border-l-2 border-white pl-5 space-y-1.5">
                <p className="text-white/40 font-mono text-[10px] tracking-widest uppercase">Final Step</p>
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Review Your Picks</h1>
                <p className="text-white/50 font-mono text-xs uppercase tracking-widest leading-relaxed pt-1">
                  These will tune your discovery feed. You can select up to 5 in each category.
                </p>
              </div>

              {/* All categories */}
              <div className="space-y-8">
                {TAXONOMY_GROUPS.map((group) => {
                  const groupSlugs = group.filters.map(f => f.slug);
                  const selectedInGroup = selectedVibes.filter(v => groupSlugs.includes(v));
                  const isGroupMaxReached = selectedInGroup.length >= 5;

                  return (
                    <div key={group.categorySlug} className="space-y-3">
                      <h2 className="font-mono text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/10 pb-1.5">
                        {group.categoryName}
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
                                "px-3.5 py-2 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-150",
                                isSelected
                                  ? "bg-white text-black border-white"
                                  : "bg-transparent text-white border-white/25 hover:border-white hover:bg-white/5",
                                isDisabled && "opacity-20 cursor-not-allowed pointer-events-none"
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

              {/* Sticky bottom bar */}
              <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-[#080808] border-t border-white/15 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="font-mono text-xs tracking-widest uppercase flex items-center gap-2">
                  <span className="text-white/50">Total Selected:</span>
                  <span className={cn(
                    "font-black px-2 py-0.5 border",
                    selectedVibes.length > 0 ? "text-white border-white/40 bg-white/10" : "text-white/30 border-white/10"
                  )}>
                    {selectedVibes.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleBack}
                    className="px-5 py-2.5 font-mono font-bold text-xs tracking-widest uppercase text-white/60 border border-white/25 hover:border-white hover:text-white transition-all duration-150 w-full sm:w-auto"
                  >
                    ← BACK
                  </button>
                  <button
                    onClick={() => completeOnboarding(selectedVibes)}
                    disabled={selectedVibes.length === 0}
                    className={cn(
                      "px-8 py-2.5 font-mono font-black text-xs tracking-widest uppercase transition-all duration-150 w-full sm:w-auto border",
                      selectedVibes.length > 0
                        ? "bg-white text-black border-white hover:bg-transparent hover:text-white"
                        : "bg-white/5 text-white/20 border-white/10 cursor-not-allowed"
                    )}
                  >
                    {hasOnboarded ? "UPDATE FEED →" : "BUILD MY FEED →"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
