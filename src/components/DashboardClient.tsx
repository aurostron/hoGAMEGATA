"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import DashboardTabs from "./DashboardTabs";
import NyanLoader from "./NyanLoader";
import AuthButton from "./AuthButton";
import { ArrowLeft } from "lucide-react";

function DashboardClientInner() {
  const { user, loading } = useAuth();
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Not logged in -> redirect to login page
      window.location.assign("/login?redirect=/dashboard");
      return;
    }

    // Authenticated -> Fetch user wishlist and collection
    async function loadDashboardData() {
      try {
        const [wishRes, colRes] = await Promise.all([
          fetch("/api/user/wishlist"),
          fetch("/api/user/collection")
        ]);

        if (wishRes.ok && colRes.ok) {
          const wishData = await wishRes.json();
          const colData = await colRes.json();
          setWishlist(wishData.wishlist || []);
          setCollection(colData.collection || []);
        } else {
          console.error("Failed to load dashboard data from API");
        }
      } catch (err) {
        console.error("Dashboard client load error:", err);
      } finally {
        setFetchingData(false);
      }
    }

    loadDashboardData();
  }, [user, loading]);

  if (loading || (!user && !loading)) {
    return <NyanLoader message="CONNECTING TO USER TERMINAL..." fullScreen={true} />;
  }

  if (fetchingData) {
    return <NyanLoader message="DECRYPTING USER STORAGE DATA..." fullScreen={true} />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <a href="/" className="hover:opacity-85">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                <span className="italic">ho</span>GAMEGATA.
              </h1>
            </a>
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
              <span>Personal Console</span>
              <span className="text-white font-black">•</span>
              <span>Developer Registry</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
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

      {/* Main Dashboard Container */}
      <main className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        <section className="pb-8 border-b border-white space-y-2">
          <span className="font-mono text-[9px] text-white uppercase tracking-widest border border-white px-2 py-0.5 font-bold bg-white text-black w-fit block">
            Terminal Active
          </span>
          <h2 className="text-3xl font-extrabold uppercase tracking-tight">
            Dashboard Specs: {user?.email}
          </h2>
          <p className="text-xs text-white/60 font-mono uppercase tracking-wider">
            Access credentials: {user?.id}
          </p>
        </section>

        <DashboardTabs
          wishlist={wishlist}
          collection={collection}
        />
      </main>
    </div>
  );
}

export default function DashboardClient() {
  return (
    <AuthProvider>
      <DashboardClientInner />
    </AuthProvider>
  );
}
