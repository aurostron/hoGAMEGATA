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

  if (authLoading || !user || ["/waitlist", "/login", "/auth/callback"].includes(pathname)) {
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

  const toggleVibe = (vibe: string) => {
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    );
  };

  const currentGroupIndex = step - 1;
  const currentGroup = TAXONOMY_GROUPS[currentGroupIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="max-w-2xl w-full border-4 border-white bg-black p-6 sm:p-10 shadow-[8px_8px_0px_0px_#ffffff] relative overflow-hidden flex flex-col gap-8 min-h-[420px]">
        {/* Progress header */}
        {step > 0 && step <= TAXONOMY_GROUPS.length && (
          <div className="flex justify-between items-center font-mono text-[9px] text-white/50 tracking-widest uppercase border-b border-white/10 pb-4 select-none">
            <span>Setup Stage {step} / {TAXONOMY_GROUPS.length}</span>
            <span>{Math.round((step / TAXONOMY_GROUPS.length) * 100)}% Complete</span>
          </div>
        )}

        <div className={cn("flex-1 flex flex-col justify-center transition-opacity duration-200", isFading ? "opacity-0" : "opacity-100")}>
          {/* Welcome Screen */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="font-mono text-xs text-white/60 font-bold uppercase tracking-widest block">// {greeting}, operator.</span>
                <h2 className="font-sans font-black text-3xl sm:text-4xl uppercase tracking-tighter leading-none text-white">
                  INITIALIZE YOUR FEED PREFERENCES
                </h2>
              </div>
              <p className="font-sans text-sm text-white/70 leading-relaxed max-w-lg">
                To tailor your horror game database feed, let's configure your catalog subgenres, visual perspectives, and gameplay styles. This shapes your dashboard recommendations and personal tracking filters.
              </p>
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-white text-black font-mono font-black text-xs tracking-widest uppercase border border-white hover:bg-transparent hover:text-white transition-all duration-150 w-full sm:w-auto"
                >
                  START SETUP →
                </button>
              </div>
            </div>
          )}

          {/* Questionnaire Steps */}
          {step > 0 && step <= TAXONOMY_GROUPS.length && currentGroup && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="font-mono text-xs text-white/50 uppercase tracking-wider block">// CATEGORY: {currentGroup.category}</span>
                <h3 className="font-sans font-black text-2xl uppercase tracking-tight text-white leading-tight">
                  {currentGroup.title}
                </h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currentGroup.options.map(option => {
                  const isSelected = selectedVibes.includes(option);
                  return (
                    <button
                      key={option}
                      onClick={() => toggleVibe(option)}
                      className={cn(
                        "p-3.5 border font-mono text-[10px] tracking-wider uppercase text-left transition-all duration-150 select-none cursor-pointer",
                        isSelected
                          ? "bg-white text-black border-white font-extrabold"
                          : "bg-transparent text-white/60 border-white/20 hover:border-white/55 hover:text-white"
                      )}
                    >
                      {isSelected ? "[X] " : "[  ] "} {option}
                    </button>
                  );
                })}
              </div>

              {/* Navigation controls */}
              <div className="flex justify-between items-center pt-6 border-t border-white/10 select-none">
                <button
                  onClick={handleBack}
                  className="px-5 py-2.5 font-mono font-bold text-xs tracking-widest uppercase text-white/60 border border-white/25 hover:border-white hover:text-white transition-all duration-150"
                >
                  ← BACK
                </button>
                <button
                  onClick={handleNext}
                  className="px-8 py-2.5 bg-white text-black font-mono font-black text-xs tracking-widest uppercase border border-white hover:bg-transparent hover:text-white transition-all duration-150"
                >
                  CONTINUE →
                </button>
              </div>
            </div>
          )}

          {/* Summary / Completion Screen */}
          {step === totalSteps && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="font-mono text-xs text-white/60 font-bold uppercase tracking-widest block">// SETUP COMPLETE</span>
                <h2 className="font-sans font-black text-3xl sm:text-4xl uppercase tracking-tighter leading-none text-white">
                  FEED PARAMETERS LOCKED
                </h2>
              </div>
              <p className="font-sans text-sm text-white/70 leading-relaxed max-w-lg">
                Your selected tags have been cached. Your dashboard and discover feed recommendations will be filtered to match your settings. You can re-adjust your preferences anytime under the options menu.
              </p>
              
              <div className="flex flex-wrap gap-2 select-none py-2 max-h-[100px] overflow-y-auto border-t border-b border-white/10">
                {selectedVibes.map(v => (
                  <span key={v} className="px-2.5 py-1 bg-white/10 text-white font-mono text-[9px] tracking-wider uppercase border border-white/10 font-bold">
                    {v}
                  </span>
                ))}
                {selectedVibes.length === 0 && (
                  <span className="text-white/40 font-mono text-xs italic">No specific preferences selected.</span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 select-none">
                <button
                  onClick={() => {
                    setSelectedVibes([]);
                    setStep(0);
                  }}
                  className="font-mono text-[10px] text-white/50 hover:text-white uppercase tracking-wider transition-colors duration-150 cursor-pointer w-full sm:w-auto text-left py-2"
                >
                  [ RESET SELECTIONS ]
                </button>

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

export default function OnboardingModal() {
  return (
    <AuthProvider>
      <OnboardingModalInner />
    </AuthProvider>
  );
}
