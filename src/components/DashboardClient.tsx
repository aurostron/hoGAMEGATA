"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import DashboardTabs from "./DashboardTabs";
import DashboardStats from "./DashboardStats";
import NyanLoader from "./NyanLoader";
import SciFiLogo from "./SciFiLogo";
import HeaderSearch from "./HeaderSearch";
import CartButton from "./CartButton";
import SettingsButton from "./SettingsButton";

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
      <header className="border-b border-white/5 bg-black sticky top-0 z-50 w-full">
        <div className="w-full px-6 md:px-12 py-2 flex items-center justify-between gap-6 h-14 sm:h-16">
          {/* Left Section: Logo */}
          <div className="flex items-center gap-6 shrink-0">
            <SciFiLogo />
          </div>

          {/* Right Section: Search & Options */}
          <div className="flex items-center gap-3 shrink-0">
            <HeaderSearch />
            <CartButton />
            <SettingsButton />
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-6xl mx-auto px-6 mt-12 space-y-12">
        <section className="pb-8 border-b border-white/5">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Dashboard
          </h2>
          <p className="text-xs text-neutral-400 mt-1.5">
            Logged in as {user?.email}
          </p>
        </section>

        {/* User Analytics Statistics Dashboard Section */}
        <DashboardStats
          wishlist={wishlist}
          collection={collection}
        />

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
