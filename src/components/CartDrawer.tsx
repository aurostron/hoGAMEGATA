"use client";

import React, { useState, useEffect } from "react";
import { useCart, type CartItem } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { 
  X, Trash2, ExternalLink, Sparkles, Check, 
  HelpCircle, ChevronRight, ShoppingBag, ArrowRight
} from "lucide-react";

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

  // Reset checkout copilot when drawer closes or cart changes
  useEffect(() => {
    if (!isOpen) {
      setActiveCopilot(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-mono select-none">
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
                            className={`w-8 h-8 flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                              isDone 
                                ? "border-emerald-500 bg-emerald-500 text-black" 
                                : "border-white/40 hover:border-white text-transparent"
                            }`}
                          >
                            <Check className="w-5 h-5 stroke-[3.5]" />
                          </button>
                          <div className="min-w-0">
                            <span className={`text-sm sm:text-base font-black uppercase truncate block ${isDone ? "line-through text-white/30" : "text-white"}`}>
                              {item.gameTitle}
                            </span>
                            <span className="text-xs sm:text-sm text-white/60 uppercase block font-mono mt-1">
                              {item.storeName} — {formatPrice(item.dealPrice, item.currency)}
                            </span>
                          </div>
                        </div>

                        {!isDone && item.dealUrl && (
                          <a
                            href={item.dealUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2.5 bg-white text-black hover:bg-red-500 hover:text-white hover:border-red-500 border border-white font-mono text-xs font-black uppercase tracking-wider shrink-0 transition-colors duration-150 leading-none cursor-pointer"
                            title={`Open ${item.storeName} deal`}
                          >
                            [ OPEN {item.storeName.toUpperCase()} ]
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setActiveCopilot(false)}
                  className="w-full py-3 border border-white/40 hover:border-white text-white/60 hover:text-white transition-all text-xs sm:text-sm font-black uppercase cursor-pointer text-center font-mono tracking-wider"
                >
                  Back to Cart
                </button>
              </div>
            ) : cartItems.length === 0 ? (
              /* Empty Cart State */
              <div className="h-full flex flex-col items-center justify-center text-center py-20 space-y-4">
                <div className="w-14 h-14 border border-white/20 flex items-center justify-center rounded-none text-white/30 bg-zinc-900/30">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm sm:text-base uppercase font-black text-white block font-mono">
                    Your cart is empty
                  </span>
                  <span className="text-xs sm:text-sm text-white/80 font-sans leading-normal block max-w-xs">
                    It's feels empty in here, why don't you add some games, huh?
                  </span>
                </div>
              </div>
            ) : (
              /* Grouped items list */
              <div className="space-y-6">
                {stores.map((store) => {
                  const items = groupedItems[store];
                  const storeSubtotal = items.reduce((sum, item) => sum + item.dealPrice, 0);
                  return (
                    <div key={store} className="border border-white/10 bg-zinc-950/20 p-4 space-y-4">
                      {/* Store group header */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-sm sm:text-base font-black uppercase text-white tracking-widest font-mono">
                          {store} DEALS
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-white/70 font-mono">
                          {items.length} {items.length === 1 ? "item" : "items"} · {formatPrice(storeSubtotal, items[0].currency)}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-5">
                        {items.map((item) => (
                          <div key={item.gameId} className="flex gap-4 relative group">
                            {/* Cover */}
                            <div className="w-20 h-24 bg-neutral-900 border border-white/15 shrink-0 overflow-hidden relative">
                              {item.coverUrl ? (
                                <img 
                                  src={item.coverUrl} 
                                  alt={item.gameTitle} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] text-white/30 uppercase font-mono">
                                  No Cover
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div>
                                <h4 className="text-sm sm:text-base font-extrabold uppercase tracking-wide truncate text-white leading-tight">
                                  {item.gameTitle}
                                </h4>
                                
                                {/* Store Selector Dropdown */}
                                {item.allDeals && item.allDeals.length > 1 ? (
                                  <select
                                    value={item.storeName}
                                    onChange={(e) => handleStoreChange(item, e.target.value)}
                                    className="mt-2 font-mono text-xs sm:text-sm uppercase border border-white/40 bg-black text-white px-2.5 py-1.5 outline-none cursor-pointer hover:border-white focus:border-white block w-full max-w-[220px]"
                                  >
                                    {item.allDeals.map((d: any) => (
                                      <option key={d.storeName} value={d.storeName}>
                                        {d.storeName} — {formatPrice(d.dealPrice, d.currency)}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-xs sm:text-sm text-white/50 block mt-1.5 uppercase font-mono">
                                    {item.storeName} deal
                                  </span>
                                )}
                              </div>

                              {/* Price Row */}
                              <div className="flex items-center gap-2.5 font-mono mt-2">
                                {item.discountPercent > 0 && (
                                  <span className="text-xs bg-red-950 text-red-500 border border-red-500 px-1.5 py-0.5 font-black">
                                    -{item.discountPercent}%
                                  </span>
                                )}
                                <span className="text-sm sm:text-base font-black text-emerald-400">
                                  {formatPrice(item.dealPrice, item.currency)}
                                </span>
                                {item.discountPercent > 0 && (
                                  <span className="text-xs text-white/50 line-through">
                                    {formatPrice(item.retailPrice, item.currency)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={() => removeFromCart(item.gameId)}
                              className="text-white/30 hover:text-red-400 border border-transparent hover:border-red-500/20 p-1.5 transition-all cursor-pointer self-start"
                              title="Remove item"
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
          </div>

          {/* Footer summary */}
          {cartItems.length > 0 && !activeCopilot && (
            <div className="border-t border-white/20 p-5 bg-zinc-950/90 space-y-4">
              <div className="flex items-center justify-between font-mono text-sm sm:text-base">
                <span className="text-white/50 uppercase">Subtotal</span>
                <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {formatPrice(totalValue, cartItems[0]?.currency)}
                </span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={startUnifiedCheckout}
                  className="w-full py-4 bg-white hover:bg-red-500 text-black hover:text-white border border-white hover:border-red-500 text-sm sm:text-base font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 rounded-none font-mono shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  <span>Begin Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={clearCart}
                  className="w-full py-2.5 border border-white/20 hover:border-white text-white/50 hover:text-white text-xs sm:text-sm uppercase tracking-wider cursor-pointer transition-all duration-150 rounded-none font-mono"
                >
                  Clear Cart
                </button>
              </div>

              {!user && (
                <span className="text-[10px] sm:text-xs text-white/30 font-sans text-center block leading-normal pt-1.5">
                  * Optional: Sign in/register to automatically sync your cart to the cloud.
                </span>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
