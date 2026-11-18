"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { addToCart } from "@/lib/cart";

type Props = {
  productId: string;
  name: string;
  unit: string;
  price: number;
  max: number;
};

export default function AddToCartButton({ productId, name, unit, price, max }: Props) {
  const [added, setAdded] = useState(false);
  const habis = max <= 0;

  function handleClick() {
    addToCart({ productId, name, unit, price, max });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      onClick={handleClick}
      disabled={habis}
      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
    >
      {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
      {habis ? "Stok habis" : added ? "Ditambahkan" : "Tambah ke keranjang"}
    </button>
  );
}