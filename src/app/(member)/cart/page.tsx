"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { CartItem, getCart, saveCart } from "@/lib/cart";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setItems(getCart());
    load();
    setReady(true);
    window.addEventListener("cart-updated", load);
    return () => window.removeEventListener("cart-updated", load);
  }, []);

  function changeQty(productId: string, delta: number) {
    const next = items.map((i) =>
      i.productId === productId
        ? { ...i, qty: Math.min(Math.max(i.qty + delta, 1), i.max) }
        : i
    );
    saveCart(next);
  }

  function remove(productId: string) {
    saveCart(items.filter((i) => i.productId !== productId));
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (!ready) return null;

  if (items.length === 0) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
          <ShoppingCart className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-slate-800">Keranjang masih kosong</h1>
        <Link href="/catalog" className="text-sm text-emerald-700 font-medium hover:underline">
          Lihat katalog barang
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">Keranjang</h1>

      <div className="space-y-3">
        {items.map((i) => (
          <div
            key={i.productId}
            className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{i.name}</p>
              <p className="text-sm text-slate-500">
                {rupiah(i.price)} per {i.unit}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeQty(i.productId, -1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{i.qty}</span>
                <button
                  onClick={() => changeQty(i.productId, 1)}
                  disabled={i.qty >= i.max}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <p className="w-28 text-right font-semibold text-emerald-700">
                {rupiah(i.price * i.qty)}
              </p>

              <button
                onClick={() => remove(i.productId)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Hapus"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-xl font-bold text-emerald-700">{rupiah(total)}</p>
        </div>
        <button
          disabled
          className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-200 text-slate-400 cursor-not-allowed"
        >
          Checkout (segera)
        </button>
      </div>
    </div>
  );
}