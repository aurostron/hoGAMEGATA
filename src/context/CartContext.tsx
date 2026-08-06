"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

export interface CartItem {
  gameId: string;
  gameTitle: string;
  gameSlug: string;
  coverUrl: string | null;
  storeName: string; // The chosen storefront
  dealPrice: number;
  retailPrice: number;
  discountPercent: number;
  dealUrl: string;
  currency: string;
  allDeals?: any[];
}

interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  addToCart: (game: any, selectedStore?: string) => Promise<void>;
  removeFromCart: (gameId: string) => Promise<void>;
  updateCartItemStore: (gameId: string, storeName: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const getInitialCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("gamegata_cart");
    if (!raw || raw === "undefined" || raw === "null") return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>(getInitialCart);
  const [loading, setLoading] = useState(false);

  // Helper: Find the cheapest deal for a game in a specific region
  const getCheapestDeal = (game: any, region = "US") => {
    const snapshots = game.priceSnapshots || [];
    let regional = snapshots.filter((p: any) => p.country === region);
    if (regional.length === 0) {
      regional = snapshots.filter((p: any) => p.country === "US");
    }
    if (regional.length === 0) {
      regional = snapshots;
    }

    if (regional.length > 0) {
      const sorted = [...regional].sort((a: any, b: any) => a.dealPrice - b.dealPrice);
      return sorted[0];
    }

    // Fallback if no price snapshots but has purchase links
    const itchLink = game.purchaseLinks?.find(
      (l: any) => l.storeName.toLowerCase() === "itch.io" || l.storeName.toLowerCase() === "itch"
    );
    if (itchLink) {
      return {
        storeName: "itch.io",
        dealPrice: 0, // Free or unknown, default 0
        retailPrice: 0,
        discountPercent: 0,
        dealUrl: itchLink.url,
        currency: "USD",
      };
    }

    return {
      storeName: game.purchaseLinks?.[0]?.storeName || "Direct Store",
      dealPrice: 0,
      retailPrice: 0,
      discountPercent: 0,
      dealUrl: game.purchaseLinks?.[0]?.url || "",
      currency: "USD",
    };
  };

  // Helper: Load local cart items
  const getLocalCart = (): CartItem[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("gamegata_cart");
      if (!raw || raw === "undefined" || raw === "null") return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to load local cart:", e);
      return [];
    }
  };

  // Helper: Save local cart items
  const saveLocalCart = (items: CartItem[]) => {
    if (typeof window === "undefined") return;
    try {
      const validItems = Array.isArray(items) ? items : [];
      localStorage.setItem("gamegata_cart", JSON.stringify(validItems));
      window.dispatchEvent(new Event("gamegata_cart_updated"));
    } catch (e) {
      console.error("Failed to save local cart:", e);
    }
  };

  // Fetch / Sync cart state
  const loadCart = async () => {
    setLoading(true);
    try {
      const local = getLocalCart();
      
      // Instantly show local cached state to ensure zero UI delay/flicker
      if (local.length > 0 && cartItems.length === 0) {
        setCartItems(local);
      }

      if (user) {
        // Logged In: Sync local to cloud first if there are guest items
        if (local.length > 0) {
          try {
            const syncRes = await fetch("/api/user/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: local.map(item => ({
                  gameId: item.gameId,
                  storeName: item.storeName,
                })),
              }),
            });
            if (syncRes.ok) {
              // Successfully synced, safe to clear local storage
              localStorage.removeItem("gamegata_cart");
            }
          } catch (syncErr) {
            console.error("Failed to sync guest cart to DB:", syncErr);
          }
        }

        // Fetch user's cart from cloud
        const res = await fetch("/api/user/cart");
        if (res.ok) {
          const data = await res.json();
          // Transform db games into CartItem models
          const region = localStorage.getItem("gamegata_currency_region") || "US";
          const items: CartItem[] = (data.cart || []).map((game: any) => {
            // Find deal matching the user's selectedStore or fallback to cheapest
            const chosenStore = game.selectedStore;
            let deal = (game.priceSnapshots || []).find(
              (p: any) => p.storeName === chosenStore && p.country === region
            );
            if (!deal) {
              deal = (game.priceSnapshots || []).find(
                (p: any) => p.storeName === chosenStore
              );
            }
            if (!deal) {
              deal = getCheapestDeal(game, region);
            }

            return {
              gameId: game.id,
              gameTitle: game.title,
              gameSlug: game.slug,
              coverUrl: game.coverUrl,
              storeName: deal.storeName,
              dealPrice: deal.dealPrice,
              retailPrice: deal.retailPrice,
              discountPercent: deal.discountPercent,
              dealUrl: deal.dealUrl,
              currency: deal.currency || "USD",
              allDeals: game.priceSnapshots || []
            };
          });

          setCartItems(items);
          saveLocalCart(items);
        }
      } else {
        // Guest: Load local storage and resolve metadata dynamically from database
        if (local.length > 0) {
          const ids = local.map(item => item.gameId).join(",");
          try {
            const res = await fetch(`/api/user/cart?gameIds=${encodeURIComponent(ids)}`);
            if (res.ok) {
              const data = await res.json();
              const region = localStorage.getItem("gamegata_currency_region") || "US";
              const resolvedItems: CartItem[] = (data.cart || []).map((game: any) => {
                const localItem = local.find(item => item.gameId === game.id);
                const chosenStore = localItem?.storeName;

                let deal = (game.priceSnapshots || []).find(
                  (p: any) => p.storeName === chosenStore && p.country === region
                );
                if (!deal) {
                  deal = (game.priceSnapshots || []).find(
                    (p: any) => p.storeName === chosenStore
                  );
                }
                if (!deal) {
                  deal = getCheapestDeal(game, region);
                }

                return {
                  gameId: game.id,
                  gameTitle: game.title,
                  gameSlug: game.slug,
                  coverUrl: game.coverUrl,
                  storeName: deal.storeName,
                  dealPrice: deal.dealPrice,
                  retailPrice: deal.retailPrice,
                  discountPercent: deal.discountPercent,
                  dealUrl: deal.dealUrl,
                  currency: deal.currency || "USD",
                  allDeals: game.priceSnapshots || []
                };
              });
              setCartItems(resolvedItems);
            } else {
              setCartItems(local);
            }
          } catch (fetchErr) {
            console.error("Failed to fetch guest cart metadata:", fetchErr);
            setCartItems(local);
          }
        } else {
          setCartItems([]);
        }
      }
    } catch (err) {
      console.error("Failed to load cart items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadCart();
    }

    // Add window listener to stay in sync across components/tabs
    const handleCartUpdate = () => {
      if (!user) {
        setCartItems(getLocalCart());
      } else {
        // For authenticated users, reload from API to get fresh DB states
        loadCart();
      }
    };

    const handleCurrencyUpdate = () => {
      loadCart();
    };

    window.addEventListener("gamegata_cart_updated", handleCartUpdate);
    window.addEventListener("gamegata_currency_updated", handleCurrencyUpdate);

    return () => {
      window.removeEventListener("gamegata_cart_updated", handleCartUpdate);
      window.removeEventListener("gamegata_currency_updated", handleCurrencyUpdate);
    };
  }, [user, authLoading]);

  // Add to Cart
  const addToCart = async (game: any, selectedStore?: string) => {
    const region = localStorage.getItem("gamegata_currency_region") || "US";
    
    // Resolve which deal to use
    let deal;
    if (selectedStore) {
      deal = (game.priceSnapshots || []).find(
        (p: any) => p.storeName.toLowerCase() === selectedStore.toLowerCase() && p.country === region
      );
      if (!deal) {
        deal = (game.priceSnapshots || []).find(
          (p: any) => p.storeName.toLowerCase() === selectedStore.toLowerCase()
        );
      }
    }
    if (!deal) {
      deal = getCheapestDeal(game, region);
    }

    const newItem: CartItem = {
      gameId: game.id,
      gameTitle: game.title,
      gameSlug: game.slug,
      coverUrl: game.coverUrl,
      storeName: deal.storeName,
      dealPrice: deal.dealPrice,
      retailPrice: deal.retailPrice,
      discountPercent: deal.discountPercent,
      dealUrl: deal.dealUrl,
      currency: deal.currency || "USD",
      allDeals: game.priceSnapshots || game.allDeals || [],
    };

    // Update Local
    const local = getLocalCart();
    const filtered = local.filter(item => item.gameId !== game.id);
    const updated = [...filtered, newItem];
    
    if (!user) {
      saveLocalCart(updated);
    } else {
      // Sync to cloud
      try {
        const res = await fetch("/api/user/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: game.id,
            storeName: deal.storeName,
          }),
        });
        if (res.ok) {
          // Trigger local update to sync UI
          window.dispatchEvent(new Event("gamegata_cart_updated"));
        }
      } catch (err) {
        console.error("Failed to add to database cart:", err);
      }
    }
  };

  // Remove from Cart
  const removeFromCart = async (gameId: string) => {
    if (!user) {
      const local = getLocalCart();
      const updated = local.filter(item => item.gameId !== gameId);
      saveLocalCart(updated);
    } else {
      try {
        const res = await fetch("/api/user/cart", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        });
        if (res.ok) {
          window.dispatchEvent(new Event("gamegata_cart_updated"));
        }
      } catch (err) {
        console.error("Failed to delete from database cart:", err);
      }
    }
  };

  // Update chosen storefront deal in cart
  const updateCartItemStore = async (gameId: string, storeName: string) => {
    if (!user) {
      const local = getLocalCart();
      const updated = local.map(item => {
        if (item.gameId !== gameId) return item;

        // Fetch parent pricing info if we can, or just keep same but query deals
        // For local storage updates, we might need the game's actual snapshots.
        // As a fallback, if we don't have the original game list, we can fetch
        // the pricing list or do a quick update. Let's see if we can resolve this
        // in CartDrawer itself, or by fetching the game prices.
        // For simplicity: CartDrawer will pass the deal details when changing store!
        return item; // will be handled directly in the drawer using addToCart with store choice
      });
      // Drawer will just call `addToCart(game, newStoreName)` to update!
    } else {
      try {
        const res = await fetch("/api/user/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, storeName }),
        });
        if (res.ok) {
          window.dispatchEvent(new Event("gamegata_cart_updated"));
        }
      } catch (err) {
        console.error("Failed to update database cart item store:", err);
      }
    }
  };

  // Clear Cart
  const clearCart = async () => {
    if (!user) {
      saveLocalCart([]);
    } else {
      try {
        const res = await fetch("/api/user/cart", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clearAll: true }),
        });
        if (res.ok) {
          window.dispatchEvent(new Event("gamegata_cart_updated"));
        }
      } catch (err) {
        console.error("Failed to clear database cart:", err);
      }
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        loading: loading || authLoading,
        addToCart,
        removeFromCart,
        updateCartItemStore,
        clearCart,
        refreshCart: loadCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    return {
      cartItems: [],
      addToCart: async () => {},
      removeFromCart: async () => {},
      clearCart: async () => {},
      totalItems: 0,
      totalPrice: 0,
      loading: false,
      refreshCart: async () => {},
    };
  }
  return context;
}
