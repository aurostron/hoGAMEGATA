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
        // Supabase Auth session syncing
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
          });
        }
        
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || "",
            });
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
  }, []);

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
        document.cookie = `gamegata-session=${cookieVal}; path=/; max-age=31536000; SameSite=Lax`;
        
        // Synchronously call API to ensure user exists in the local DB
        await fetch("/api/user/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mockId, email }),
        });

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

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      document.cookie = "gamegata-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;";
    }
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSupabase: isSupabaseConfigured, login, signUp, logout }}>
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
