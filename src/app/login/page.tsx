"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, ArrowLeft } from "lucide-react";

function LoginForm() {
  const { user, login, signUp, isSupabase } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  // Prevent open redirect attacks — only allow relative paths
  const redirectUrl = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // If already logged in, redirect away
  useEffect(() => {
    if (user) {
      router.push(redirectUrl);
    }
  }, [user, redirectUrl, router]);

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
            setTimeout(() => router.push(redirectUrl), 1000);
          }
        } else {
          setErrorMsg(res.error || "Failed to register.");
        }
      } else {
        const res = await login(email, password);
        if (res.success) {
          setSuccessMsg("Authentication successful! Redirecting...");
          setTimeout(() => router.push(redirectUrl), 1000);
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

  return (
    <div className="w-full max-w-md border border-white bg-black p-8 space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-extrabold uppercase tracking-tight">
          {isRegistering ? "Register Spec" : "Authorization Key"}
        </h2>
        <p className="text-xs text-white/60 font-mono uppercase tracking-wider">
          {isRegistering ? "Establish new profile keys" : "Authenticate terminal credentials"}
        </p>
      </div>

      {/* Mode Indicator Banner */}
      <div className="border border-white p-3.5 flex gap-3 items-start bg-black font-mono text-[10px] leading-relaxed uppercase">
        <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
        <div>
          <span className="font-black text-white block mb-0.5">
            {isSupabase ? "Supabase Mode Connected" : "Local Mock Mode Active"}
          </span>
          <span className="text-white/60">
            {isSupabase 
              ? "Real server database synchronization enabled via cloud OAuth."
              : "No Supabase env credentials found. Type any email to log in instantly. Local PostgreSQL storage applies."}
          </span>
        </div>
      </div>

      {/* Message Banners */}
      {errorMsg && (
        <div className="border border-white bg-white text-black p-3 text-xs font-mono font-bold uppercase text-center">
          [ ERROR: {errorMsg} ]
        </div>
      )}
      {successMsg && (
        <div className="border border-white bg-black text-white p-3 text-xs font-mono font-bold uppercase text-center">
          [ SUCCESS: {successMsg} ]
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

        <button
          type="submit"
          disabled={authLoading}
          className="w-full py-3 border border-white bg-black text-white hover:bg-white hover:text-black font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50"
        >
          {authLoading ? "[ Syncing... ]" : isRegistering ? "[ Register Account ]" : "[ Authenticate ]"}
        </button>
      </form>

      {/* Toggles */}
      <div className="pt-4 border-t border-white/20 text-center font-mono text-[10px] uppercase">
        <button
          type="button"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setErrorMsg("");
            setSuccessMsg("");
          }}
          className="text-white hover:underline tracking-wider font-bold"
        >
          {isRegistering 
            ? "[ Already registered? Authenticate here ]" 
            : "[ Create new database profile key ]"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-white bg-black">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link href="/" className="hover:opacity-85">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                <span className="italic">ho</span>GAMEGATA.
              </h1>
            </Link>
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
              <span>Authentication Gateway</span>
              <span className="text-white font-black">•</span>
              <span>Secure Session</span>
            </div>
          </div>
          <div>
            <Link 
              href="/" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ Back to Search ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-6 my-12">
        <Suspense fallback={
          <div className="w-full max-w-md border border-white bg-black p-8 space-y-6 text-center font-mono text-xs text-white/50 animate-pulse">
            [ Initializing Auth Terminal... ]
          </div>
        }>
          <LoginForm />
        </Suspense>
      </main>

      {/* Spacer to make sure layout matches footer placement */}
      <div></div>
    </div>
  );
}
