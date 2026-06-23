"use client";

import React, { useState, useEffect } from "react";
import { useAuth, AuthProvider } from "../context/AuthContext";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import SciFiLogo from "./SciFiLogo";

function LoginForm() {
  const { user, login, signUp, loginWithGoogle, isSupabase } = useAuth();
  
  const [redirectUrl, setRedirectUrl] = useState("/");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isCapped, setIsCapped] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const rawRedirect = searchParams.get("redirect") || "/";
      const cleanRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
      setRedirectUrl(cleanRedirect);

      const errorParam = searchParams.get("error");
      if (errorParam === "limit_reached") {
        setErrorMsg("Registration limit of 10,000 users has been reached.");
      } else if (errorParam === "auth_failed") {
        setErrorMsg("Authentication failed. Please try again.");
      }
    }
  }, []);

  // Check if signup cap is reached
  useEffect(() => {
    async function checkLimit() {
      try {
        const res = await fetch("/api/user/check-limit");
        if (res.ok) {
          const data = await res.json();
          if (data.capped) {
            setIsCapped(true);
            setIsRegistering(false); // Force off registration tab
          }
        }
      } catch (err) {
        console.error("Failed to query user limit status:", err);
      }
    }
    checkLimit();
  }, []);

  // If already logged in, redirect away
  useEffect(() => {
    if (user) {
      window.location.assign(redirectUrl);
    }
  }, [user, redirectUrl]);

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

    if (isSupabase && !password) {
      setErrorMsg("Password is required in Supabase Mode.");
      setAuthLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const res = await signUp(email, password);
        if (res.success) {
          if (isSupabase) {
            setSuccessMsg("Registration successful! Check your email for confirmation link.");
          } else {
            setSuccessMsg("Registration successful! Redirecting...");
            setTimeout(() => window.location.assign(redirectUrl), 1000);
          }
        } else {
          setErrorMsg(res.error || "Failed to register.");
        }
      } else {
        const res = await login(email, password);
        if (res.success) {
          setSuccessMsg("Authentication successful! Redirecting...");
          setTimeout(() => window.location.assign(redirectUrl), 1000);
        } else {
          setErrorMsg(res.error || "Failed to login.");
        }
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred during authorization.");
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
    <div className="w-full max-w-md border border-white bg-black p-8 space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white">
          {isRegistering ? "Create Account" : "Sign In"}
        </h2>
        <p className="text-xs text-white/60 font-mono uppercase tracking-wider">
          {isRegistering ? "Register for a new account" : "Sign in to your account"}
        </p>
      </div>

      {/* Capped Banner */}
      {isCapped && (
        <div className="border border-white p-3.5 bg-black font-mono text-[10px] leading-relaxed uppercase text-white font-bold tracking-tight text-center animate-pulse">
          [ Account registrations are currently closed ]
          <span class="block font-normal text-white/60 mt-1">Only existing users can sign in at this time.</span>
        </div>
      )}

      {/* Mode Indicator Banner */}
      <div className="border border-white p-3.5 flex gap-3 items-start bg-black font-mono text-[10px] leading-relaxed uppercase text-white">
        <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
        <div>
          <span className="font-black text-white block mb-0.5">
            {isSupabase ? "Online Mode Active" : "Demo Mode Active"}
          </span>
          <span className="text-white/60">
            {isSupabase 
              ? "You are connected to our live account services."
              : "The site is running in demo mode. You can enter any email to log in instantly. Your changes are saved locally."}
          </span>
        </div>
      </div>

      {/* Message Banners */}
      {errorMsg && (
        <div className="border border-white bg-white text-black p-3 text-xs font-mono font-bold uppercase text-center">
          [ Error: {errorMsg} ]
        </div>
      )}
      {successMsg && (
        <div className="border border-white bg-black text-white p-3 text-xs font-mono font-bold uppercase text-center">
          [ Success: {successMsg} ]
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        <div className="space-y-2">
          <label htmlFor="email" className="font-bold uppercase tracking-wider text-white">Email Address</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="developer@hogamegata.com"
            className="block w-full px-3.5 py-2.5 bg-black border border-white rounded-none focus:outline-none text-white placeholder-white/40 transition-all font-medium"
          />
        </div>

        {isSupabase && (
          <div className="space-y-2">
            <label htmlFor="password" className="font-bold uppercase tracking-wider text-white">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full px-3.5 py-2.5 bg-black border border-white rounded-none focus:outline-none text-white placeholder-white/40 transition-all font-medium"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 border border-white bg-black text-white hover:bg-white hover:text-black font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            {authLoading ? "[ Loading... ]" : isRegistering ? "[ Create Account ]" : "[ Sign In ]"}
          </button>

          <div className="relative flex py-1.5 items-center">
            <div className="flex-grow border-t border-white/20"></div>
            <span className="flex-shrink mx-4 text-[9px] text-white/40 uppercase tracking-widest font-black">OR</span>
            <div className="flex-grow border-t border-white/20"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full py-3 border border-white bg-white text-black hover:bg-black hover:text-white font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>[ Sign In with Google ]</span>
          </button>
        </div>
      </form>

      {/* Toggles */}
      {!isCapped && (
        <div className="pt-4 border-t border-white/20 text-center font-mono text-[10px] uppercase">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="text-white hover:underline tracking-wider font-bold cursor-pointer"
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

export default function LoginPage() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col justify-between">
        {/* Header */}
        <header className="border-b border-white bg-black sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <SciFiLogo withLink={true} />
              <div className="flex items-center gap-2 font-mono text-[12px] tracking-widest text-white uppercase font-bold mt-1">
                <span>Horror</span>
                <span className="text-white font-black">•</span>
                <span>Game</span>
                <span className="text-white font-black">•</span>
                <span>Mega</span>
                <span className="text-white font-black">•</span>
                <span>Metadata</span>
              </div>
            </div>
            <div>
              <a 
                href="/" 
                className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>[ Back to Search ]</span>
              </a>
            </div>
          </div>
        </header>

        {/* Main Login Card */}
        <main className="flex-1 flex items-center justify-center p-6 my-12">
          <LoginForm />
        </main>

        {/* Spacer to make sure layout matches footer placement */}
        <div></div>
      </div>
    </AuthProvider>
  );
}
