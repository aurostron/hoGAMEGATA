"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSupabase: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
      if (isSupabaseConfigured && supabase) {
        const client = supabase;
        // Supabase Auth session syncing
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) {
          try {
            // Verify and sync user state with database
            const res = await fetch("/api/user/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: session.user.id, email: session.user.email }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              if (res.status === 403 || data.error?.toLowerCase().includes("limit")) {
                await client.auth.signOut();
                setUser(null);
                router.push("/login?error=limit_reached");
                setLoading(false);
                return;
              }
            }

            setUser({
              id: session.user.id,
              email: session.user.email || "",
            });
          } catch (syncErr) {
            console.error("Initial auth sync failed:", syncErr);
          }
        }
        
        // Listen for changes
        const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            try {
              const res = await fetch("/api/user/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: session.user.id, email: session.user.email }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 403 || data.error?.toLowerCase().includes("limit")) {
                  await client.auth.signOut();
                  setUser(null);
                  router.push("/login?error=limit_reached");
                  return;
                }
              }

              setUser({
                id: session.user.id,
                email: session.user.email || "",
              });
            } catch (syncErr) {
              console.error("Auth state change sync failed:", syncErr);
            }
          } else {
            setUser(null);
          }
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } else {
        // Local Mock Auth session syncing
        const sessionVal = getCookie("gamegata-session");
        if (sessionVal) {
          try {
            const decoded = decodeURIComponent(sessionVal);
            const [id, email] = decoded.split(":");
            if (id && email) {
              setUser({ id, email });
            }
          } catch (e) {
            console.error("Error parsing mock session cookie:", e);
          }
        }
        setLoading(false);
      }
    }

    initAuth();
  }, [router]);

  const login = async (email: string, password?: string) => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: password || "",
        });
        if (error) throw error;
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || "",
          });
        }
        return { success: true };
      } else {
        // Mock login: Generate a deterministic mock user ID based on email
        const mockId = "mock-" + Math.abs(email.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)).toString(16);
        const cookieVal = encodeURIComponent(`${mockId}:${email}`);
        document.cookie = `gamegata-session=${cookieVal}; path=/; max-age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
        
        // Check database limit before syncing
        const checkRes = await fetch("/api/user/check-limit");
        const checkData = await checkRes.json().catch(() => ({ capped: false }));
        
        if (checkData.capped) {
          // If the user already exists, let them log in
          const checkUserSync = await fetch("/api/user/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: mockId, email }),
          });
          if (!checkUserSync.ok) {
            document.cookie = "gamegata-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            return { success: false, error: "Registration limit of 10,000 users has been reached." };
          }
        } else {
          await fetch("/api/user/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: mockId, email }),
          });
        }

        setUser({ id: mockId, email });
        router.refresh();
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to authenticate" };
    }
  };

  const signUp = async (email: string, password?: string) => {
    try {
      // Check user limit first
      const checkRes = await fetch("/api/user/check-limit");
      const checkData = await checkRes.json().catch(() => ({ capped: false }));
      if (checkData.capped) {
        return { success: false, error: "Registration limit of 10,000 users has been reached." };
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: password || "",
        });
        if (error) throw error;
        return { success: true };
      } else {
        // Mock sign up behaves the same as login
        return login(email, password);
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to sign up" };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const checkRes = await fetch("/api/user/check-limit");
      const checkData = await checkRes.json().catch(() => ({ capped: false }));
      if (checkData.capped) {
        return { success: false, error: "Registration limit of 10,000 users has been reached." };
      }

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        return { success: true };
      } else {
        // Mock Google Login: Generate a random google-mock user
        const randId = "g-mock-" + Math.floor(Math.random() * 10000);
        const mockEmail = `google.user.${randId}@gmail.com`;
        return login(mockEmail);
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to initiate Google sign in" };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      document.cookie = "gamegata-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    }
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSupabase: isSupabaseConfigured, login, signUp, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
