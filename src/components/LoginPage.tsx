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
        const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
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
    <div className="w-full max-w-sm sm:max-w-md border border-white/10 bg-neutral-950/70 backdrop-blur-md rounded-2xl p-5 sm:p-7 space-y-3.5 sm:space-y-4 shadow-2xl">
      <div className="space-y-1 text-center">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-white">
          {isRegistering ? "Create Account" : "Sign In"}
        </h2>
        <p className="text-[10px] sm:text-xs text-white/50 font-sans uppercase tracking-widest">
          {isRegistering ? "Register for a new account" : "Sign in to your account"}
        </p>
      </div>

      {isCapped && (
        <div className="border border-white/15 p-2.5 bg-black font-sans text-[11px] leading-relaxed uppercase text-white font-bold tracking-wider text-center animate-pulse rounded-xl">
          Account registrations are currently closed
          <span className="block font-normal text-white/60 mt-0.5">Only existing users can sign in at this time.</span>
        </div>
      )}

      {errorMsg && (
        <div className="border border-red-500/30 bg-red-950/20 text-red-200 p-2.5 text-xs font-sans font-bold uppercase text-center rounded-xl">
          Error: {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 p-2.5 text-xs font-sans font-bold uppercase text-center rounded-xl">
          Success: {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 font-sans text-sm">
        <div className="space-y-1">
          <label htmlFor="email" className="font-semibold uppercase tracking-wider text-white/80 text-[10px] sm:text-xs">Email Address</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nevergonnagiveyou@up.com"
            className="block w-full px-3.5 py-2.5 bg-neutral-900/40 border border-white/15 rounded-xl focus:outline-none focus:border-white/40 text-white placeholder-white/25 transition-all text-xs sm:text-sm font-sans"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="font-semibold uppercase tracking-wider text-white/80 text-[10px] sm:text-xs">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="block w-full px-3.5 py-2.5 bg-neutral-900/40 border border-white/15 rounded-xl focus:outline-none focus:border-white/40 text-white placeholder-white/25 transition-all text-xs sm:text-sm font-sans"
          />
        </div>
        
        {isRegistering && (
          <div className="flex items-start gap-2.5 py-0.5 font-sans">
            <input
              id="age-terms-agree"
              type="checkbox"
              required
              checked={agreedAge}
              onChange={(e) => setAgreedAge(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded-sm border border-white/20 bg-neutral-900/40 checked:bg-white checked:border-white text-black focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer shrink-0 transition-all duration-150"
            />
            <label htmlFor="age-terms-agree" className="text-[10px] sm:text-[11px] text-white/50 leading-tight tracking-wide select-none cursor-pointer font-sans hover:text-white/80 transition-colors duration-150">
              By signing up, you agree that you are at least 16 years of age or older, and agree to our{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-white underline decoration-white/30 hover:decoration-white hover:text-red-400 font-semibold transition-colors"
              >
                Terms & Conditions
              </a>
              .
            </label>
          </div>
        )}

        {/* Cloudflare Turnstile Container */}
        <div className="flex justify-center py-0.5">
          <div id="turnstile-container" />
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2.5 sm:py-3 border border-white/15 bg-white text-black hover:bg-white/90 font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 cursor-pointer rounded-xl text-xs"
          >
            {authLoading ? "Loading..." : isRegistering ? "Create Account" : "Sign In"}
          </button>

          <div className="relative flex py-0.5 items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-3 text-[9px] text-white/40 uppercase tracking-widest font-black">OR</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full py-2.5 sm:py-3 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer rounded-xl text-xs"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Sign In with Google</span>
          </button>
        </div>
      </form>

      {!isCapped && (
        <div className="pt-2 border-t border-white/10 text-center font-sans text-[10px] sm:text-[11px]">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="text-white/40 hover:text-white hover:underline decoration-white/30 underline-offset-4 tracking-wider font-bold cursor-pointer font-sans uppercase transition-all duration-200"
          >
            {isRegistering 
              ? "Already have an account? Sign in here" 
              : "Need an account? Register here"}
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
      <div className="h-screen h-[100dvh] w-full bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col md:flex-row relative overflow-hidden">
        {/* Left Panel: Form & Navigation */}
        <div className="w-full md:w-[460px] lg:w-[480px] xl:w-[500px] shrink-0 z-20 bg-black/80 md:bg-black/45 md:backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 lg:p-7 h-full relative overflow-y-auto md:overflow-hidden">
          {/* Header area with Logo */}
          <div className="shrink-0 flex items-center justify-between">
            <SciFiLogo withLink={true} />
          </div>

          {/* Form */}
          <main className="my-auto py-2 flex items-center justify-center min-h-0">
            <LoginForm />
          </main>

          {/* Bottom Bar: Clean Return Button & Copyright (No box, no duplicate borders) */}
          <div className="shrink-0 flex items-center justify-between gap-3 pt-2 select-none">
            <a 
              href="/" 
              className="group inline-flex items-center gap-2 font-mono text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-white/20 transition-all duration-200 px-4 py-2 rounded-full font-bold uppercase tracking-wider active:scale-[0.97] cursor-pointer select-none"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              <span>Return to Storefront</span>
            </a>
            <span className="font-mono text-[9px] sm:text-[10px] text-white/40 uppercase tracking-widest">
              © 2026 hoGAMEGATA
            </span>
          </div>
        </div>

        {/* Right Panel: Ken Burns Image Slideshow Background */}
        <div className="absolute inset-0 z-10 select-none pointer-events-none overflow-hidden">
          {/* Blur & Contrast Overlay */}
          <div className="absolute inset-0 bg-black/30 md:bg-black/0 backdrop-blur-[1px] z-10" />
          
          {/* Left-to-Right Fade (Desktop only) */}
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
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 font-mono text-[10px] sm:text-xs uppercase tracking-wider text-white/80 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 select-none pointer-events-none shadow-lg">
              {screenshots[currentSlide].gameName} <span className="text-white/40 font-sans font-normal lowercase">by</span> {screenshots[currentSlide].devName}
            </div>
          )}
        </div>
      </div>
    </AuthProvider>
  );
}
