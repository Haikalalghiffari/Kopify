"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/money";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  available: number;
};
type PosMember = { id: string; memberNo: string; name: string };
type CartLine = { productId: string; qty: number };
type Method = "TUNAI" | "TRANSFER" | "BON" | "LAINNYA";

export default function PosClient({
  products,
  members,
}: {
  products: PosProduct[];
  members: PosMember[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<Method>("TUNAI");
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const subtotal = cart.reduce((sum, l) => sum + l.qty * (byId.get(l.productId)?.price ?? 0), 0);
  const discountNum = Math.max(0, Math.floor(Number(discount) || 0));
  const total = Math.max(0, subtotal - discountNum);

  function add(p: PosProduct) {
    setSuccess("");
    setCart((prev) => {
      const line = prev.find((l) => l.productId === p.id);
      if (line) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, qty: Math.min(l.qty + 1, p.available) } : l
        );
      }
      return [...prev, { productId: p.id, qty: 1 }];
    });
  }

  function setQty(productId: string, value: number) {
    const max = byId.get(productId)?.available ?? 0;
    if (!Number.isFinite(value) || value <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, qty: Math.min(Math.floor(value), max) } : l
      )
    );
  }

  function remove(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  async function pay() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          memberId: memberId || null,
          discount: discountNum,
          paymentMethod: method,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan penjualan.");
        return;
      }
      setSuccess(`Transaksi ${data.saleNo} tersimpan.`);
      setCart([]);
      setDiscount("0");
      setMemberId("");
      setMethod("TUNAI");
      router.refresh(); // muat ulang stok terbaru
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Daftar barang */}
      <div className="lg:col-span-2 space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau SKU barang..."
          className={input}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const habis = p.available <= 0;
            return (
              <button
                key={p.id}
                onClick={() => add(p)}
                disabled={habis}
                className="text-left p-3 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                <p className="text-xs text-slate-500">{p.sku}</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatRupiah(p.price)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {habis ? "Habis" : `Stok ${p.available} ${p.unit}`}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-slate-500">Barang tidak ditemukan.</p>
          )}
        </div>
      </div>

      {/* Keranjang kasir */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4 h-fit">
        <h2 className="font-semibold text-slate-800">Keranjang</h2>

        {cart.length === 0 && <p className="text-sm text-slate-500">Belum ada barang.</p>}

        <ul className="space-y-3">
          {cart.map((l) => {
            const p = byId.get(l.productId)!;
            return (
              <li key={l.productId} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-slate-700">{p.name}</span>
                  <span className="text-slate-700">{formatRupiah(p.price * l.qty)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={p.available}
                    value={l.qty}
                    onChange={(e) => setQty(l.productId, Number(e.target.value))}
                    className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm"
                  />
                  <span className="text-xs text-slate-500">
                    × {formatRupiah(p.price)} / {p.unit}
                  </span>
                  <button
                    onClick={() => remove(l.productId)}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div>
            <label className="text-xs text-slate-500">Anggota (kosongkan untuk umum)</label>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={input}>
              <option value="">Pembeli umum</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.memberNo} · {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Metode bayar</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className={input}
            >
              <option value="TUNAI">Tunai</option>
              <option value="TRANSFER">Transfer</option>
              <option value="BON">Bon (anggota)</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Diskon (Rp)</label>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Diskon</span>
            <span>- {formatRupiah(discountNum)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700 text-base">
            <span>Total</span>
            <span>{formatRupiah(total)}</span>
          </div>
        </div>

        <button
          onClick={pay}
          disabled={loading || cart.length === 0}
          className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Bayar"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </div>
    </div>
  );
}