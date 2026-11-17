"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

export default function CatalogFilter({
  categories,
  activeCategory,
}: {
  categories: any[];
  activeCategory?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const selectedCat = activeCategory || "ALL";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (selectedCat && selectedCat !== "ALL") params.set("category", selectedCat);
    router.push(`/member/catalog?${params.toString()}`);
  };

  const handleSelectCategory = (catId: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (catId !== "ALL") params.set("category", catId);
    router.push(`/member/catalog?${params.toString()}`);
  };

  const handleReset = () => {
    setQ("");
    router.push("/member/catalog");
  };

  return (
    <div className="space-y-4">
      {/* Search Input Bar (Visible if searching) */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama barang atau kode SKU..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-800 placeholder-gray-400 text-xs sm:text-sm rounded-full pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B3B2C] shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-[#0B3B2C] hover:bg-[#134B39] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors shadow-sm"
        >
          Cari
        </button>
        {(q || (selectedCat && selectedCat !== "ALL")) && (
          <button
            type="button"
            onClick={handleReset}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-full transition-colors"
            title="Reset filter"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Filter Category Pills (Signature Gromuse Design Element) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => handleSelectCategory("ALL")}
          className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
            selectedCat === "ALL"
              ? "bg-[#0B3B2C] text-white ring-2 ring-[#0B3B2C]/20"
              : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/80"
          }`}
        >
          ✨ Semua Barang
        </button>

        {categories.map((c) => {
          const isActive = selectedCat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectCategory(c.id)}
              className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                isActive
                  ? "bg-[#0B3B2C] text-white ring-2 ring-[#0B3B2C]/20"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/80"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
