"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { TrendingUp, Package, Award, ArrowUpRight, Boxes } from "lucide-react";

export default function DashboardWidgets({
  topProducts,
  topStock,
}: {
  topProducts: { name: string; sku: string; qty: number; revenue: number; unit: string }[];
  topStock: { name: string; sku: string; stock: number; unit: string; valueCost: number }[];
}) {
  const [productSortBy, setProductSortBy] = useState<"QTY" | "REVENUE">("QTY");

  const sortedTopProducts = [...topProducts].sort((a, b) =>
    productSortBy === "QTY" ? b.qty - a.qty : b.revenue - a.revenue
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. WIDGET BARANG TERLARIS (PRD 6.7 - FR-7.1) */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#0B3B2C]">Barang Terlaris</h3>
              <p className="text-[11px] text-gray-400">Paling banyak dipesan & dibeli</p>
            </div>
          </div>

          {/* Sort toggle (Kuantitas vs Omzet) */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setProductSortBy("QTY")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                productSortBy === "QTY"
                  ? "bg-[#0B3B2C] text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Kuantitas
            </button>
            <button
              onClick={() => setProductSortBy("REVENUE")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                productSortBy === "REVENUE"
                  ? "bg-[#0B3B2C] text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Omzet
            </button>
          </div>
        </div>

        {sortedTopProducts.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Belum ada data barang terjual
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
            {sortedTopProducts.slice(0, 10).map((p, idx) => (
              <div key={p.sku} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      idx === 0
                        ? "bg-amber-400 text-amber-950"
                        : idx === 1
                        ? "bg-gray-300 text-gray-800"
                        : idx === 2
                        ? "bg-amber-200 text-amber-900"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900 leading-snug">{p.name}</p>
                    <span className="text-[10px] text-gray-400">{p.sku}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-black text-gray-900">
                    {productSortBy === "QTY"
                      ? `${p.qty} ${p.unit}`
                      : formatRupiah(p.revenue)}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    {productSortBy === "QTY"
                      ? formatRupiah(p.revenue)
                      : `${p.qty} ${p.unit}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. WIDGET STOK TERBANYAK & NILAI PERSEDIAAN (PRD 6.7) */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">Stok Terbanyak di Gudang</h3>
            <p className="text-[11px] text-gray-400">Posisi fisik persediaan tertinggi</p>
          </div>
        </div>

        {topStock.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Belum ada data barang
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
            {topStock.slice(0, 10).map((p, idx) => (
              <div key={p.sku} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900 leading-snug">{p.name}</p>
                    <span className="text-[10px] text-gray-400">{p.sku}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-black text-[#0B3B2C]">
                    {p.stock} {p.unit}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    Nilai: {formatRupiah(p.valueCost)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
