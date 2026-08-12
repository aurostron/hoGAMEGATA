"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authClient } from "../lib/auth-client";
import NyanLoader from "../components/NyanLoader";

interface User {
  id: string;
  email: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSupabase: boolean; // Retained for compatibility with components checking Supabase Mode
  login: (email: string, password?: string, captchaToken?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password?: string, captchaToken?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("gamegata_user_cache");
    if (!raw || raw === "undefined" || raw === "null") return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object" && typeof parsed.email === "string") ? parsed : null;
  } catch (e) {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Helper to read cookie
  const getCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  };

  useEffect(() => {
    async function initAuth() {
      try {
        // 1. Check for active session using Better Auth client
        const { data: session } = await authClient.getSession();
        if (session?.user) {
          const u = {
            id: session.user.id,
            email: session.user.email,
            avatarUrl: session.user.image || undefined,
          };
          setUser(u);
          try {
            localStorage.setItem("gamegata_user_cache", JSON.stringify(u));
          } catch (e) {}
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Initial Better Auth session retrieval failed:", err);
      }

      // 2. Mock session fallback (development fallback)
      const sessionVal = getCookie("gamegata-session");
      if (sessionVal) {
        try {
          const decoded = decodeURIComponent(sessionVal);
          const [id, email] = decoded.split(":");
          if (id && email) {
            const u = { id, email };
            setUser(u);
            try {
              localStorage.setItem("gamegata_user_cache", JSON.stringify(u));
            } catch (e) {}
          }
        } catch (e) {
          console.error("Error parsing mock session cookie:", e);
        }
      } else {
        setUser(null);
        try {
          localStorage.removeItem("gamegata_user_cache");
        } catch (e) {}
      }
      setLoading(false);
    }

    initAuth();
  }, []);

  // Sync guest wishlist items to the Turso Auth database on login, and pull cloud wishlists to local cache
  useEffect(() => {
    async function syncWishlist() {
      if (!user) return;
      try {
        const res = await fetch("/api/user/wishlist");
        if (res.ok) {
          const data = await res.json();
          const cloudIds = (data.wishlist || []).map((g: any) => g.id);
          
          const localRaw = localStorage.getItem("gamegata_wishlist");
          const localIds = localRaw ? JSON.parse(localRaw) : [];
          
          const merged = Array.from(new Set([...localIds, ...cloudIds]));
          localStorage.setItem("gamegata_wishlist", JSON.stringify(merged));
          
          const newLocalIds = localIds.filter((id: string) => !cloudIds.includes(id));
          if (newLocalIds.length > 0) {
            await fetch("/api/user/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: newLocalIds }),
            });
          }
        }
      } catch (err) {
        console.error("Failed to sync guest wishlist on login/mount:", err);
      }
    }

    syncWishlist();
  }, [user]);

  const login = async (email: string, password?: string, captchaToken?: string) => {
    try {
      // Check database limit before signing in
      const checkRes = await fetch("/api/user/check-limit");
      const checkData = await checkRes.json().catch(() => ({ capped: false }));
      if (checkData.capped) {
        return { success: false, error: "Registration limit of 10,000 users has been reached." };
      }

      // Call Better Auth client signIn
      const { data, error } = await authClient.signIn.email({
        email,
        password: password || "",
      }, {
        headers: captchaToken ? { "x-captcha-token": captchaToken } : undefined
      });

      if (error) throw error;

      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          avatarUrl: data.user.image || undefined,
        });
      }
      return { success: true };
    } catch (err: any) {
      // Mock Login Fallback (For local email-only testing, or if credentials are mock profiles)
      if (import.meta.env.DEV && (email.startsWith("mock") || !password)) {
        const mockId = "mock-" + Math.abs(email.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)).toString(16);
        const cookieVal = encodeURIComponent(`${mockId}:${email}`);
        document.cookie = `gamegata-session=${cookieVal}; path=/; max-age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
        
        setUser({ id: mockId, email });
        window.location.reload();
        return { success: true };
      }
      return { success: false, error: err.message || "Failed to authenticate" };
    }
  };

  const signUp = async (email: string, password?: string, captchaToken?: string) => {
    try {
      // Check database limit before registering
      const checkRes = await fetch("/api/user/check-limit");
      const checkData = await checkRes.json().catch(() => ({ capped: false }));
      if (checkData.capped) {
        return { success: false, error: "Registration limit of 10,000 users has been reached." };
      }

      // Call Better Auth client signUp
      const { data, error } = await authClient.signUp.email({
        email,
        password: password || "",
        name: email.split("@")[0],
      }, {
        headers: captchaToken ? { "x-captcha-token": captchaToken } : undefined
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      if (import.meta.env.DEV && (email.startsWith("mock") || !password)) {
        return login(email, password, captchaToken);
      }
      return { success: false, error: err.message || "Failed to sign up" };
    }
  };

  const loginWithGoogle = async () => {
    try {
      // Check database limit before registering
      const checkRes = await fetch("/api/user/check-limit");
      const checkData = await checkRes.json().catch(() => ({ capped: false }));
      if (checkData.capped) {
        return { success: false, error: "Registration limit of 10,000 users has been reached." };
      }

      // Call Better Auth client social signin (Google)
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      return { success: true };
    } catch (err: any) {
      // Mock Google Login Fallback
      if (import.meta.env.DEV) {
        const randId = "g-mock-" + Math.floor(Math.random() * 10000);
        const mockEmail = `google.user.${randId}@gmail.com`;
        return login(mockEmail);
      }
      return { success: false, error: err.message || "Failed to initiate Google sign in" };
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    // Visual pause to render session termination animation
    await new Promise(resolve => setTimeout(resolve, 1800));

    try {
      await authClient.signOut();
    } catch (e) {
      console.warn("Better Auth signOut failed, proceeding to clear local state:", e);
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Server logout failed, proceeding to clear local state:', e);
    }
    // Always clear local fallback mock cookies & local wishlist cache
    document.cookie = "gamegata-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    try {
      localStorage.removeItem("gamegata_user_cache");
      localStorage.removeItem("gamegata_wishlist");
      localStorage.removeItem("gamegata_cart");
    } catch (e) {}
    setUser(null);
    setLoggingOut(false);
    window.location.assign("/");
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSupabase: true, login, signUp, loginWithGoogle, logout }}>
      {loggingOut && <NyanLoader message="SEE YOU AGAIN" fullScreen={true} />}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      session: null,
      loading: false,
      login: async () => {},
      logout: async () => {},
      register: async () => {},
    };
  }
  return context;
}
