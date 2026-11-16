"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/money";

type P = { id: string; sku: string; name: string; unit: string; price: number; available: number };
type M = { id: string; memberNo: string; name: string };
type Line = { productId: string; qty: number };

export default function NewOrderClient({ products, members }: { products: P[]; members: M[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [memberId, setMemberId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const total = cart.reduce((s, l) => s + l.qty * (byId.get(l.productId)?.price ?? 0), 0);

  function add(p: P) {
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

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, items: cart, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat pesanan.");
        return;
      }
      router.push("/admin/orders");
      router.refresh();
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
                  <span className="font-bold text-emerald-700 text-sm">{formatRupiah(p.price)}</span>
                  <span className="text-xs text-slate-500">
                    {habis ? "Habis" : `Stok ${p.available} ${p.unit}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4 h-fit">
        <h2 className="font-semibold text-slate-800">Pesanan</h2>

        <div>
          <label className="text-xs text-slate-500">Atas nama anggota</label>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={input}>
            <option value="">Pilih anggota...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.memberNo} · {m.name}
              </option>
            ))}
          </select>
        </div>

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
                    onClick={() => setQty(l.productId, 0)}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div>
          <label className="text-xs text-slate-500">Catatan (opsional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={input}
          />
        </div>

        <div className="flex justify-between font-bold text-emerald-700 border-t border-slate-100 pt-3">
          <span>Total</span>
          <span>{formatRupiah(total)}</span>
        </div>

        <button
          onClick={submit}
          disabled={loading || cart.length === 0 || !memberId}
          className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Buat pesanan"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}