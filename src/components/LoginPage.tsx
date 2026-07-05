"use client";

import React, { useState, useEffect } from "react";
import { useAuth, AuthProvider } from "../context/AuthContext";
import { ArrowLeft } from "lucide-react";
import SciFiLogo from "./SciFiLogo";

function LoginForm() {
  const { user, login, signUp, loginWithGoogle, isSupabase } = useAuth();
  
  const [redirectUrl, setRedirectUrl] = useState("/");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isCapped, setIsCapped] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [captchaToken, setCaptchaToken] = useState("");
  const [agreedAge, setAgreedAge] = useState(false);
  const turnstileWidgetId = React.useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const rawRedirect = searchParams.get("redirect") || "/";
      const cleanRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
      setRedirectUrl(cleanRedirect);

      const errorParam = searchParams.get("error");
      if (errorParam) {
        if (errorParam === "limit_reached") {
          setErrorMsg("Registration cap of 10,000 users has been reached.");
        } else if (errorParam === "auth_failed") {
          setErrorMsg("Authentication failed. Please try again.");
        } else {
          setErrorMsg(decodeURIComponent(errorParam));
        }
      }
    }
  }, []);

  useEffect(() => {
    // 1. Setup explicit Turnstile load callback on window
    (window as any).onloadTurnstileCallback = () => {
      if ((window as any).turnstile) {
        const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x000000000000000000001";
        turnstileWidgetId.current = (window as any).turnstile.render("#turnstile-container", {
          sitekey: siteKey,
          theme: "dark",
          callback: (token: string) => {
            setCaptchaToken(token);
          },
          "expired-callback": () => {
            setCaptchaToken("");
          },
          "error-callback": () => {
            setCaptchaToken("");
          }
        });
      }
    };

    // 2. Load script dynamically
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      delete (window as any).onloadTurnstileCallback;
    };
  }, [isRegistering]); // Re-initialize Turnstile widget if we switch forms

  useEffect(() => {
    async function checkLimit() {
      try {
        const res = await fetch("/api/user/check-limit");
        if (res.ok) {
          const data = await res.json();
          if (data.capped) {
            setIsCapped(true);
            setIsRegistering(false); 
          }
        }
      } catch (err) {
        console.error("Failed to query user limit status:", err);
      }
    }
    checkLimit();
  }, []);

  useEffect(() => {
    if (user) {
      window.location.assign(redirectUrl);
    }
  }, [user, redirectUrl]);

  const resetTurnstile = () => {
    if ((window as any).turnstile && turnstileWidgetId.current) {
      try {
        (window as any).turnstile.reset(turnstileWidgetId.current);
      } catch (e) {
        console.error("Failed to reset Turnstile widget:", e);
      }
    }
    setCaptchaToken("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setAuthLoading(true);

    if (!email) {
      setErrorMsg("Email address is required.");
      setAuthLoading(false);
      return;
    }

    if (!password) {
      setErrorMsg("Password is required.");
      setAuthLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        if (!agreedAge) {
          setErrorMsg("You must confirm you are at least 16 years old and agree to the terms to register.");
          setAuthLoading(false);
          return;
        }
        const res = await signUp(email, password, captchaToken);
        if (res.success) {
          setSuccessMsg("Registration successful! Check your email for confirmation link.");
          resetTurnstile();
        } else {
          setErrorMsg(res.error || "Failed to register.");
          resetTurnstile();
        }
      } else {
        const res = await login(email, password, captchaToken);
        if (res.success) {
          setSuccessMsg("Authentication successful! Redirecting...");
          setTimeout(() => window.location.assign(redirectUrl), 1000);
        } else {
          setErrorMsg(res.error || "Failed to login.");
          resetTurnstile();
        }
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred during authorization.");
      resetTurnstile();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setAuthLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res && !res.success) {
        setErrorMsg(res.error || "Failed to authenticate with Google.");
        setAuthLoading(false);
      }
    } catch (err) {
      setErrorMsg("Failed to initiate Google sign in.");
      setAuthLoading(false);
    }
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="w-full max-w-md border border-white/10 bg-neutral-950/60 backdrop-blur-md rounded-2xl p-8 sm:p-10 space-y-6 shadow-2xl">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-white">
          {isRegistering ? "Create Account" : "Sign In"}
        </h2>
        <p className="text-xs sm:text-sm text-white/50 font-sans uppercase tracking-widest">
          {isRegistering ? "Register for a new account" : "Sign in to your account"}
        </p>
      </div>

      {isCapped && (
        <div className="border border-white/15 p-3.5 bg-black font-sans text-xs leading-relaxed uppercase text-white font-bold tracking-wider text-center animate-pulse rounded-xl">
          [ Account registrations are currently closed ]
          <span className="block font-normal text-white/60 mt-1">Only existing users can sign in at this time.</span>
        </div>
      )}

      {errorMsg && (
        <div className="border border-red-500/30 bg-red-950/20 text-red-200 p-3.5 text-xs font-sans font-bold uppercase text-center rounded-xl">
          [ Error: {errorMsg} ]
        </div>
      )}
      {successMsg && (
        <div className="border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 p-3.5 text-xs font-sans font-bold uppercase text-center rounded-xl">
          [ Success: {successMsg} ]
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 font-sans text-sm">
        <div className="space-y-2">
          <label htmlFor="email" className="font-semibold uppercase tracking-wider text-white/80 text-[11px] sm:text-xs">Email Address</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nevergonnagiveyou@up.com"
            className="block w-full px-4 py-3 bg-neutral-900/30 border border-white/15 rounded-xl focus:outline-none text-white placeholder-white/25 transition-all text-sm sm:text-base font-sans"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="font-semibold uppercase tracking-wider text-white/80 text-[11px] sm:text-xs">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="block w-full px-4 py-3 bg-neutral-900/30 border border-white/15 rounded-xl focus:outline-none text-white placeholder-white/25 transition-all text-sm sm:text-base font-sans"
          />
        </div>
        
        {isRegistering && (
          <div className="flex items-start gap-3 py-1 font-sans">
            <input
              id="age-terms-agree"
              type="checkbox"
              required
              checked={agreedAge}
              onChange={(e) => setAgreedAge(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-sm border border-white/20 bg-neutral-900/40 checked:bg-white checked:border-white text-black focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer shrink-0 transition-all duration-150"
            />
            <label htmlFor="age-terms-agree" className="text-[10px] sm:text-[11px] text-white/50 leading-relaxed tracking-wide select-none cursor-pointer font-sans hover:text-white/80 transition-colors duration-150">
              By signing up, you agree that you are at least 16 years of age or older, and agree to our Terms & Conditions.
            </label>
          </div>
        )}

        {/* Cloudflare Turnstile Container */}
        <div className="flex justify-center py-1">
          <div id="turnstile-container" />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3.5 border border-white/15 bg-white text-black hover:bg-white/90 font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 cursor-pointer rounded-xl text-xs sm:text-sm"
          >
            {authLoading ? "[ Loading... ]" : isRegistering ? "[ Create Account ]" : "[ Sign In ]"}
          </button>

          <div className="relative flex py-1.5 items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-[10px] text-white/40 uppercase tracking-widest font-black">OR</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full py-3.5 border border-white/15 bg-black text-white hover:bg-neutral-900 font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer rounded-xl text-xs sm:text-sm"
          >
            <span>[ Sign In with Google ]</span>
          </button>
        </div>
      </form>

      {!isCapped && (
        <div className="pt-4 border-t border-white/10 text-center font-sans text-xs">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="text-white/60 hover:text-white tracking-widest font-bold cursor-pointer font-sans text-[11px] uppercase transition-colors"
          >
            {isRegistering 
              ? "[ Already have an account? Sign in here ]" 
              : "[ Need an account? Register here ]"}
          </button>
        </div>
      )}
    </div>
  );
}

interface Screenshot {
  url: string;
  gameName: string;
  devName: string;
}

export default function LoginPage({ screenshots = [] }: { screenshots?: Screenshot[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [screenshots]);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col md:flex-row relative overflow-hidden">
        {/* Left Panel: Form & Navigation */}
        <div className="w-full md:w-[45%] lg:w-[40%] xl:w-[35%] shrink-0 z-20 bg-black/70 md:bg-transparent flex flex-col justify-between relative min-h-screen">
          {/* Top spacer to push form down when no header is present */}
          <div className="h-8 md:h-12"></div>

          {/* Form */}
          <main className="flex-1 flex items-center justify-center px-6 py-12 md:py-8">
            <LoginForm />
          </main>

          {/* Footer Navigation (Replicates site footer) */}
          <footer className="px-6 py-8 border-t border-white/5 bg-black/80 md:bg-black/40 backdrop-blur-sm select-none">
            <div className="flex flex-col gap-4 font-sans text-[10px] text-white/50 uppercase tracking-widest font-normal">
              <div className="pt-3 border-t border-white/10 flex items-center">
                <a 
                  href="/" 
                  className="group inline-flex items-center gap-2 font-mono text-xs text-white hover:text-white uppercase tracking-wider transition-colors duration-150 font-bold"
                >
                  
                  <span>[ Back to the main page ]</span>
                </a>
              </div>
              <div className="flex flex-col gap-1">
                <span>© 2026 hoGAMEGATA</span>
              </div>
            </div>
          </footer>
        </div>

        {/* Right Panel: Ken Burns Image Slideshow Background */}
        <div className="absolute inset-0 z-10 select-none pointer-events-none overflow-hidden">
          {/* Blur & Contrast Overlay */}
          <div className="absolute inset-0 bg-black/30 md:bg-black/0 backdrop-blur-[1px] z-10" />
          
          {/* Left-to-Right Fade (Desktop only) - Lighter solid black under left panel (90% at 28%), drops rapidly to 10% by 42% width, then fades to transparent */}
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black via-black/90 via-[28%] via-black/10 via-[42%] to-transparent z-20 hidden md:block" />
          
          {/* Bottom-to-Top Fade (Mobile only) */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/60 to-transparent z-20 md:hidden" />

          {/* Slides */}
          {screenshots.length > 0 ? (
            screenshots.map((src, idx) => (
              <div
                key={src.url}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out transform transition-transform duration-[6000ms] ${
                  idx === currentSlide ? "opacity-100 scale-105" : "opacity-0 scale-100"
                }`}
                style={{
                  backgroundImage: `url(${src.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            ))
          ) : (
            <div className="absolute inset-0 bg-neutral-900" />
          )}

          {/* Game Info Metadata Display (Bottom Right) */}
          {screenshots.length > 0 && screenshots[currentSlide] && (
            <div className="absolute bottom-6 right-8 z-30 font-sans text-[10px] sm:text-xs uppercase tracking-widest text-neutral-400 text-right select-none pointer-events-none">
              {screenshots[currentSlide].gameName} by {screenshots[currentSlide].devName}
            </div>
          )}
        </div>
      </div>
    </AuthProvider>
  );
}
