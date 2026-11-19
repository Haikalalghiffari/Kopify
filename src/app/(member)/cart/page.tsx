"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart, CheckCircle2 } from "lucide-react";
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
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ orderNo: string; total: number } | null>(null);

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

  async function checkout() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout gagal.");
        return;
      }
      setDone({ orderNo: data.orderNo, total: data.total });
      saveCart([]);
    } catch {
      setError("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (!ready) return null;

  if (done) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-slate-800">Pesanan berhasil diajukan</h1>
        <p className="text-sm text-slate-500">
          Nomor pesanan <span className="font-semibold text-slate-800">{done.orderNo}</span>{" "}
          dengan total {rupiah(done.total)}. Menunggu konfirmasi kasir.
        </p>
        <Link href="/catalog" className="text-sm text-emerald-700 font-medium hover:underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }

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

      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
        <label className="block text-sm text-slate-500">
          Catatan untuk kasir (opsional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-xl font-bold text-emerald-700">{rupiah(total)}</p>
          </div>
          <button
            onClick={checkout}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Memproses..." : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}