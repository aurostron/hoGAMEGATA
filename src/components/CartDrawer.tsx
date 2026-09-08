"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCart, type CartItem } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { 
  X, Trash2, ExternalLink, Sparkles, Check, 
  HelpCircle, ChevronRight, ShoppingBag, ArrowRight
} from "lucide-react";
import { getCloudinaryFetchUrl } from "../lib/utils";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { user } = useAuth();
  const { cartItems, removeFromCart, addToCart, clearCart } = useCart();
  const [activeCopilot, setActiveCopilot] = useState<boolean>(false);
  const [copilotSteps, setCopilotSteps] = useState<CartItem[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset checkout copilot when drawer closes or cart changes
  useEffect(() => {
    if (!isOpen) {
      setActiveCopilot(false);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Format currency helpers
  const formatPrice = (amount: number, currencyCode = "USD") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch (e) {
      return `$${amount.toFixed(2)}`;
    }
  };

  // Group items by storefront
  const groupedItems = cartItems.reduce((acc, item) => {
    const store = item.storeName || "Other Store";
    if (!acc[store]) acc[store] = [];
    acc[store].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const stores = Object.keys(groupedItems);
  const totalValue = cartItems.reduce((acc, item) => acc + item.dealPrice, 0);

  // Handle storefront dropdown changes
  const handleStoreChange = async (item: CartItem, newStoreName: string) => {
    const matchingDeal = item.allDeals?.find(
      (d: any) => d.storeName.toLowerCase() === newStoreName.toLowerCase()
    );

    if (matchingDeal) {
      // Re-add item to the cart with updated store deal.
      // Since our addToCart resolves by selectedStore, we construct a game wrapper.
      const gameMock = {
        id: item.gameId,
        title: item.gameTitle,
        slug: item.gameSlug,
        coverUrl: item.coverUrl,
        priceSnapshots: item.allDeals,
      };
      await addToCart(gameMock, newStoreName);
    }
  };

  // Unified Checkout Copilot Trigger
  const startUnifiedCheckout = () => {
    if (cartItems.length === 0) return;
    
    // 1. Prepare steps
    setCopilotSteps([...cartItems]);
    setCompletedSteps({});
    setActiveCopilot(true);

    // 2. Open first checkout URL automatically (subsequent ones can be opened via individual buttons)
    const firstItem = cartItems[0];
    if (firstItem && firstItem.dealUrl) {
      window.open(firstItem.dealUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Mark an item as purchased in the Copilot
  const markAsPurchased = async (item: CartItem) => {
    setCompletedSteps(prev => ({
      ...prev,
      [item.gameId]: !prev[item.gameId]
    }));

    const isMarkingTrue = !completedSteps[item.gameId];

    if (isMarkingTrue) {
      // 1. Call collection API to add as OWNED
      if (user) {
        try {
          await fetch("/api/user/collection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameId: item.gameId,
              status: "OWNED"
            })
          });
        } catch (e) {
          console.error("Failed to add game to collection:", e);
        }
      } else {
        // Save to local library
        try {
          const libRaw = localStorage.getItem("gamegata_library");
          const library = libRaw ? JSON.parse(libRaw) : {};
          library[item.gameId] = {
            gameId: item.gameId,
            gameTitle: item.gameTitle,
            gameSlug: item.gameSlug,
            wishlisted: false,
            status: "OWNED",
            rating: null,
            updatedAt: Date.now()
          };
          localStorage.setItem("gamegata_library", JSON.stringify(library));
        } catch (e) {
          console.error("Failed to save local ownership:", e);
        }
      }

      // 2. Remove from cart
      await removeFromCart(item.gameId);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden font-mono select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex">
        {/* Drawer Content */}
        <div className="w-screen max-w-md bg-black border-l border-white/20 flex flex-col justify-between shadow-2xl relative">
          
          {/* Header */}
          <div className="border-b border-white/20 p-5 flex items-center justify-between bg-zinc-950/60 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest text-white flex items-center gap-2 font-mono">
                <ShoppingBag className="w-5 h-5 text-white" />
                Shopping Cart ({cartItems.length})
              </h2>
            </div>
            <button 
              onClick={onClose} 
              className="text-white/60 hover:text-white border border-white/20 p-2 hover:bg-white hover:text-black transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
            
            {activeCopilot ? (
              /* Unified Checkout Copilot Mode */
              <div className="space-y-6 animate-fade-in">
                <div className="border border-white/30 bg-white/5 p-4">
                  <p className="text-sm sm:text-base text-white/90 leading-relaxed font-sans">
                    We've opened the first checkout page in a new tab. Click the button next to each game below to open its store page, complete payment, and check them off to sync to your collection.
                  </p>
                </div>

                <div className="space-y-4">
                  <span className="text-sm text-white uppercase font-black tracking-wider block border-b border-white/10 pb-2 font-mono">
                    Checklist
                  </span>
                  
                  {copilotSteps.map((item) => {
                    const isDone = completedSteps[item.gameId] || !cartItems.some(i => i.gameId === item.gameId);
                    return (
                      <div 
                        key={item.gameId}
                        className={`border p-4 flex items-center justify-between gap-4 transition-all duration-150 ${
                          isDone 
                            ? "border-emerald-500/30 bg-emerald-950/5 text-white/40" 
                            : "border-white/20 bg-zinc-950/40"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <button
                            onClick={() => markAsPurchased(item)}
                            className={`w-6 h-6 border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                              isDone 
                                ? "bg-emerald-500 border-emerald-500 text-black" 
                                : "border-white/30 hover:border-white text-transparent"
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                          
                          <div className="min-w-0 flex-1">
                            <span className={`text-sm font-bold block truncate ${isDone ? "line-through text-white/50" : "text-white"}`}>
                              {item.gameTitle}
                            </span>
                            <span className="text-xs text-white/50 block font-sans">
                              {item.storeName} — <strong className="text-emerald-400 font-bold">{formatPrice(item.dealPrice, item.currency)}</strong>
                            </span>
                          </div>
                        </div>

                        {item.dealUrl && (
                          <a
                            href={item.dealUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 border border-white/20 hover:border-white hover:bg-white hover:text-black transition-all text-white/70 hover:text-black shrink-0"
                            title="Open Store Checkout"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setActiveCopilot(false)}
                  className="w-full py-3 border border-white/20 text-white/70 hover:text-white hover:border-white transition-all text-xs font-mono uppercase tracking-widest"
                >
                  ← Back to Cart Overview
                </button>
              </div>
            ) : (
              /* Standard Cart View */
              <>
                {cartItems.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                    <ShoppingBag className="w-12 h-12 text-white/20" />
                    <p className="text-sm text-white/60 font-sans">Your shopping cart is currently empty.</p>
                    <p className="text-xs text-white/30 max-w-xs font-sans">Browse horror deals across Steam, GOG, and Epic to build your nightmare collection.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {stores.map((storeName) => {
                      const storeItems = groupedItems[storeName];
                      const storeSubtotal = storeItems.reduce((acc, i) => acc + i.dealPrice, 0);

                      return (
                        <div key={storeName} className="border border-white/10 bg-zinc-950/40 p-4 space-y-3">
                          {/* Store Group Header */}
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-xs font-black uppercase tracking-widest text-[#7b3fc4]">
                              {storeName}
                            </span>
                            <span className="text-xs text-white/70 font-bold font-sans">
                              Subtotal: {formatPrice(storeSubtotal, storeItems[0]?.currency)}
                            </span>
                          </div>

                          {/* Items List */}
                          <div className="space-y-3">
                            {storeItems.map((item) => (
                              <div key={item.gameId} className="flex gap-3 items-center group/item">
                                {/* Cover Thumb */}
                                {item.coverUrl ? (
                                  <img 
                                    src={getCloudinaryFetchUrl(item.coverUrl, false)} 
                                    alt={item.gameTitle}
                                    className="w-12 h-16 object-cover border border-white/10 shrink-0" 
                                  />
                                ) : (
                                  <div className="w-12 h-16 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                    <ShoppingBag className="w-4 h-4 text-white/20" />
                                  </div>
                                )}

                                {/* Game details */}
                                <div className="flex-1 min-w-0">
                                  <a 
                                    href={`/game/${item.gameSlug}`}
                                    className="text-xs font-bold text-white hover:text-red-400 truncate block font-sans transition-colors"
                                  >
                                    {item.gameTitle}
                                  </a>

                                  {/* Storefront Picker dropdown */}
                                  {item.allDeals && item.allDeals.length > 1 ? (
                                    <select
                                      value={item.storeName}
                                      onChange={(e) => handleStoreChange(item, e.target.value)}
                                      className="mt-1 bg-black border border-white/20 text-[10px] text-white/80 px-1.5 py-0.5 font-mono focus:outline-none focus:border-white cursor-pointer"
                                    >
                                      {item.allDeals.map((d: any) => (
                                        <option key={d.storeName} value={d.storeName}>
                                          {d.storeName} - {formatPrice(d.dealPrice, d.currency)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-[10px] text-white/40 block font-mono mt-0.5">
                                      {item.storeName}
                                    </span>
                                  )}

                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-bold text-emerald-400 font-sans tracking-tight">
                                      {formatPrice(item.dealPrice, item.currency)}
                                    </span>
                                    {item.discountPercent > 0 && (
                                      <span className="text-[10px] bg-[#7b3fc4] text-white font-bold px-1.5 py-0.5 rounded-xs font-sans tracking-tight">
                                        -{item.discountPercent}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Remove Button */}
                                <button
                                  onClick={() => removeFromCart(item.gameId)}
                                  className="p-1.5 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                                  title="Remove from cart"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

          </div>

          {/* Footer Actions */}
          {cartItems.length > 0 && (
            <div className="border-t border-white/20 p-5 bg-zinc-950/80 backdrop-blur space-y-3">
              <div className="flex items-center justify-between text-sm font-black uppercase tracking-wider text-white">
                <span>Total Multi-Store Value</span>
                <span className="text-emerald-400 font-sans font-bold text-lg tracking-tight">
                  {formatPrice(totalValue)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  onClick={startUnifiedCheckout}
                  className="w-full py-3.5 bg-emerald-500 text-black font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Unified Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={clearCart}
                  className="w-full py-2 bg-transparent text-white/40 hover:text-red-400 transition-colors text-[10px] uppercase tracking-widest font-mono cursor-pointer"
                >
                  Clear Cart
                </button>
              </div>

              {!user && (
                <span className="text-[10px] text-white/30 font-sans text-center block pt-2 italic">
                  * Sign in to sync your cart across devices.
                </span>
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
