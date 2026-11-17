"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ProductItemProps } from "@/components/grocery/ProductCard";
import { toast } from "sonner";

export interface CartItem {
  product: ProductItemProps;
  qty: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: ProductItemProps, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "kopify_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Gagal membaca keranjang dari penyimpanan lokal", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage whenever items change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Gagal menyimpan keranjang", e);
    }
  }, [items, isLoaded]);

  const addItem = (product: ProductItemProps, qty = 1) => {
    const available = Math.max(0, product.stock - (product.reservedStock || 0));
    if (available <= 0) {
      toast.error(`Maaf, stok untuk ${product.name} sedang habis.`);
      return;
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].qty;
        const newQty = currentQty + qty;
        if (newQty > available) {
          toast.error(`Pesanan melebihi sisa stok (${available} ${product.unit} tersedia)`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], qty: newQty };
        toast.success(`Jumlah ${product.name} ditambah menjadi ${newQty} ${product.unit}`);
        return updated;
      } else {
        if (qty > available) {
          toast.error(`Pesanan melebihi sisa stok (${available} ${product.unit} tersedia)`);
          return prev;
        }
        toast.success(`${product.name} dimasukkan ke keranjang`);
        return [...prev, { product, qty }];
      }
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
    toast.info("Barang dihapus dari keranjang");
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (!existing) return prev;

      const available = Math.max(0, existing.product.stock - (existing.product.reservedStock || 0));
      if (qty > available) {
        toast.error(`Stok maksimal yang tersedia: ${available} ${existing.product.unit}`);
        return prev;
      }

      return prev.map((item) =>
        item.product.id === productId ? { ...item, qty } : item
      );
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart harus digunakan di dalam CartProvider");
  }
  return context;
}
