import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import { Sparkles, Package } from "lucide-react";
import AddToCartButton from "@/components/member/AddToCartButton";

export const dynamic = "force-dynamic";

export default async function MemberCatalogPage() {
  const session = await getServerSession(authOptions);

  const products = await db.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: { category: true, unit: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl text-white shadow-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Portal Anggota Koperasi
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Halo, {session?.user?.name || session?.user?.username}!
        </h1>
        <p className="text-sm text-emerald-100/90 mt-1 max-w-xl">
          Pilih barang yang Anda butuhkan, lalu ambil di koperasi.
        </p>
      </div>

      {/* Daftar barang */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const available = p.stock - p.reservedStock;
          const habis = available <= 0;

          return (
            <div
              key={p.id}
              className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{p.category.name}</p>
                  <h2 className="font-semibold text-slate-800 leading-snug">{p.name}</h2>
                </div>
              </div>

              <div className="flex items-end justify-between mt-auto">
                <div>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatRupiah(p.sellPrice)}
                  </p>
                  <p className="text-xs text-slate-500">per {p.unit.name}</p>
                </div>
                <span
                  className={
                    habis
                      ? "text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full"
                      : "text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"
                  }
                >
                  {habis ? "Stok habis" : `Tersedia ${available}`}
                </span>
              </div>

              <AddToCartButton
                productId={String(p.id)}
                name={p.name}
                unit={p.unit.name}
                price={Number(p.sellPrice)}
                max={available}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}