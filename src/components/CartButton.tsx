"use client";

import React, { useState } from "react";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider, useCart } from "../context/CartContext";
import CartDrawer from "./CartDrawer";
import { ShoppingBag } from "lucide-react";

function CartButtonInner() {
  const { cartItems, loading } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const totalCount = cartItems.length;

  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("gamegata_open_cart", handleOpen);
    return () => window.removeEventListener("gamegata_open_cart", handleOpen);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center font-mono text-xs text-white hover:bg-white/10 transition-all duration-150 w-full h-full rounded-xl font-bold cursor-pointer bg-transparent select-none relative shrink-0"
        title="Open Shopping Cart"
      >
        <ShoppingBag className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
        
        {/* Count Badge */}
        {!loading && totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center font-mono text-[9px] sm:text-[10px] bg-[#7b3fc4] text-white px-1.5 py-0.5 border border-[#7b3fc4] font-black h-4.5 min-w-[18px] rounded-none">
            {totalCount}
          </span>
        )}
      </button>

      {/* Cart Drawer Panel overlay */}
      <CartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default function CartButton() {
  return (
    <AuthProvider>
      <CartProvider>
        <CartButtonInner />
      </CartProvider>
    </AuthProvider>
  );
}
