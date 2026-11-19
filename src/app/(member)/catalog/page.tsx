import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import { normalizePagination, getPaginationMeta } from "@/lib/pagination";
import { buildCatalogProductWhere } from "@/services/catalogQuery";
import { Sparkles, Package } from "lucide-react";
import AddToCartButton from "@/components/member/AddToCartButton";
import CatalogFilters from "@/components/member/CatalogFilters";
import CatalogPagination from "@/components/member/CatalogPagination";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; category?: string; page?: string };

export default async function MemberCatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  const q = (searchParams.q ?? "").trim();
  const categoryId = (searchParams.category ?? "").trim();
  const { page, pageSize, skip, take } = normalizePagination({
    page: Number(searchParams.page) || 1,
    pageSize: 12,
  });

  const where = buildCatalogProductWhere({ q, categoryId });

  const [products, totalItems, categories] = await Promise.all([
    db.product.findMany({
      where,
      include: { category: true, unit: true },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    db.product.count({ where }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const meta = getPaginationMeta(totalItems, page, pageSize);

  return (
    <div className="space-y-6">
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

      <CatalogFilters q={q} categoryId={categoryId} categories={categories} />

      <p className="text-sm text-slate-500">
        {totalItems === 0
          ? "Tidak ada barang yang cocok dengan filter."
          : `${totalItems} barang ditemukan`}
      </p>

      {products.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-600">
          Coba ubah kata kunci atau pilih kategori lain.
        </div>
      ) : (
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
                    <p className="text-xs text-slate-400 mt-0.5">SKU: {p.sku}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <p className="text-lg font-bold text-emerald-700">{formatRupiah(p.sellPrice)}</p>
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
      )}

      <CatalogPagination
        page={meta.page}
        totalPages={meta.totalPages}
        q={q}
        categoryId={categoryId}
      />
    </div>
  );
}