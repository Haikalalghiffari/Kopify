import { db } from "@/lib/db";
import Link from "next/link";
import ProductCard, { ProductItemProps } from "@/components/grocery/ProductCard";
import PromoDeals from "@/components/grocery/PromoDeals";
import CooperativeWorkflowBanner from "@/components/grocery/CooperativeWorkflowBanner";
import CatalogFilter from "./CatalogFilter";
import { ArrowRight, Sparkles, Store, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const SKU_IMAGE_MAP: Record<string, string> = {
  "VGT-001": "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=350&auto=format&fit=crop&q=80",
  "VGT-002": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=350&auto=format&fit=crop&q=80",
  "VGT-003": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=350&auto=format&fit=crop&q=80",
  "VGT-004": "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=350&auto=format&fit=crop&q=80",
  "VGT-005": "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=350&auto=format&fit=crop&q=80",
  "FRT-001": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=350&auto=format&fit=crop&q=80",
  "FRT-002": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=350&auto=format&fit=crop&q=80",
  "SMB-001": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=350&auto=format&fit=crop&q=80",
  "SMB-002": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=350&auto=format&fit=crop&q=80",
  "SMB-003": "https://images.unsplash.com/photo-1622484216744-8025e1e7cb77?w=350&auto=format&fit=crop&q=80",
  "SMB-004": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=350&auto=format&fit=crop&q=80",
  "MT-001": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=350&auto=format&fit=crop&q=80",
  "MT-002": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=350&auto=format&fit=crop&q=80",
  "MT-003": "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=350&auto=format&fit=crop&q=80",
  "MKN-001": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=350&auto=format&fit=crop&q=80",
  "MKN-002": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=350&auto=format&fit=crop&q=80",
  "DRK-001": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=350&auto=format&fit=crop&q=80",
  "DRK-002": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=350&auto=format&fit=crop&q=80",
  "MLK-001": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=350&auto=format&fit=crop&q=80",
  "KBR-001": "https://images.unsplash.com/photo-1607006314640-20cfec296531?w=350&auto=format&fit=crop&q=80",
};

const DEFAULT_GROCERY_IMG = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80";

export default async function MemberCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  const categories = await db.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  const where: any = {
    isActive: true,
    deletedAt: null,
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  if (category && category !== "ALL") {
    where.categoryId = category;
  }

  const rawProducts = await db.product.findMany({
    where,
    include: {
      category: true,
      unit: true,
    },
    orderBy: [{ stock: "desc" }, { name: "asc" }],
  });

  const productItems: ProductItemProps[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryName: p.category.name,
    unit: p.unit.name,
    price: p.sellPrice,
    stock: p.stock,
    reservedStock: p.reservedStock,
    minStock: p.minStock,
    image: SKU_IMAGE_MAP[p.sku] || DEFAULT_GROCERY_IMG,
  }));

  const youMightNeed = productItems.slice(0, 10);
  const additionalProducts = productItems.slice(10);

  return (
    <div className="space-y-12">
      {/* 1. GROMUSE HERO BANNER — Kopify (Koperasi For You) */}
      {!q && (
        <section className="bg-[#0B3B2C] text-white rounded-b-[40px] sm:rounded-b-[54px] px-6 sm:px-12 lg:px-16 pt-12 pb-24 relative overflow-hidden shadow-sm">
          <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
            {/* Left Text Column */}
            <div className="max-w-xl space-y-4 text-center md:text-left">
              <span className="inline-flex items-center gap-2 bg-[#B6F53B]/20 text-[#B6F53B] border border-[#B6F53B]/30 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide">
                <Sparkles className="h-3.5 w-3.5" />
                KOPIFY — KOPERASI FOR YOU
              </span>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12]">
                Belanja Sembako Koperasi <br className="hidden sm:block" />
                Lebih Praktis & Hemat
              </h1>

              <p className="text-emerald-100/75 text-sm sm:text-base leading-relaxed max-w-md">
                Pesan kebutuhan harian secara mandiri dari aplikasi, staf kasir menyiapkan pesanan Anda, lalu ambil dan selesaikan pembayaran langsung di gerai kasir tanpa antre.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4">
                <a
                  href="#catalog-view"
                  className="inline-block bg-[#B6F53B] hover:bg-[#a5e628] text-[#0B3B2C] font-extrabold px-8 py-3.5 rounded-full text-sm shadow-md transition-all hover:scale-105 active:scale-95"
                >
                  Lihat Katalog Sembako
                </a>

                <span className="text-xs text-emerald-200/90 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-[#B6F53B]" /> Ambil & Bayar di Kasir
                </span>
              </div>
            </div>

            {/* Right Graphic: Grocery Bag */}
            <div className="relative">
              <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-[#134B39]/50 flex items-center justify-center p-4 relative">
                <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-3xl bg-[#07271D] border border-white/10 flex flex-col items-center justify-center text-7xl sm:text-8xl shadow-2xl relative">
                  🏪
                  <span className="text-xs font-bold text-[#B6F53B] bg-[#0B3B2C] px-3.5 py-1 rounded-full border border-[#B6F53B]/30 absolute bottom-4 shadow">
                    Gerai Kasir Koperasi
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Container */}
      <div id="catalog-view" className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* 2. CATEGORY QUICK BROWSE ROW */}
        {!q && !category && (
          <section className="-mt-20 sm:-mt-24 relative z-20">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {categories.slice(0, 5).map((c, i) => {
                const icons = ["🌾", "🥦", "🥑", "🍗", "🥛"];
                const descriptions = [
                  "Beras, minyak, gula",
                  "Sayuran segar gerai",
                  "Buah lokal pilihan",
                  "Ayam & daging halal",
                  "Susu & minuman",
                ];
                return (
                  <Link
                    key={c.id}
                    href={`/member/catalog?category=${c.id}`}
                    className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between hover:shadow-md transition cursor-pointer group"
                  >
                    <div>
                      <h3 className="font-bold text-sm text-[#0B3B2C] group-hover:text-emerald-700 transition-colors">
                        {c.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{descriptions[i % descriptions.length]}</p>
                    </div>
                    <div className="text-right text-3xl mt-4 group-hover:scale-110 transition-transform">
                      {icons[i % icons.length]}
                    </div>
                  </Link>
                );
              })}

              {/* See all (Lime Green Card) */}
              <Link
                href="/member/catalog"
                className="bg-[#B6F53B] hover:bg-[#a5e628] rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm hover:scale-[1.02] transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mb-1.5">
                  <ArrowRight className="h-5 w-5 text-[#0B3B2C] stroke-[2.5]" />
                </div>
                <span className="font-extrabold text-xs text-[#0B3B2C]">Semua Kategori</span>
              </Link>
            </div>
          </section>
        )}

        {/* 3. FILTER PILLS & SEARCH */}
        <section className="space-y-4">
          <CatalogFilter categories={categories} activeCategory={category} />
        </section>

        {/* 4. SECTION 1: "You might need" (Tersedia Berdasarkan Stok Real di Database) */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-[#0B3B2C] tracking-tight">
                {q ? `Pencarian: "${q}"` : "Katalog Kebutuhan Pokok"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {productItems.length} barang terdaftar dengan stok fisik riil di koperasi
              </p>
            </div>

            <Link
              href="/member/catalog"
              className="text-xs font-bold text-[#A63A24] hover:underline inline-flex items-center gap-1"
            >
              Lihat semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {productItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <span className="text-4xl block mb-2">🔍</span>
              <h3 className="text-base font-bold text-[#0B3B2C]">Barang tidak ditemukan</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Barang yang Anda cari mungkin sedang kosong di gerai atau kata kunci tidak sesuai.
              </p>
              <Link
                href="/member/catalog"
                className="mt-4 inline-block bg-[#EAF6EE] text-[#0B3B2C] text-xs font-bold px-4 py-2 rounded-full hover:bg-emerald-100 transition-colors"
              >
                Tampilkan Semua Barang
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {youMightNeed.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* 5. PROMO DEALS ROW (Split-Tone 4 Cards: SHU, Anggota, Stok, Kasir) */}
        {!q && (
          <section className="py-2">
            <PromoDeals />
          </section>
        )}

        {/* 6. SECTION 2: "Weekly best selling items" (Produk Stok Tambahan Real Database) */}
        {!q && additionalProducts.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-[#0B3B2C] tracking-tight">
                  Barang Paling Laris Minggu Ini
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Produk dengan perputaran transaksi tertinggi di kasir koperasi
                </p>
              </div>

              <Link
                href="/member/catalog"
                className="text-xs font-bold text-[#A63A24] hover:underline inline-flex items-center gap-1"
              >
                Lihat semua <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {additionalProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* 7. COOPERATIVE WORKFLOW BANNER (Alur Kasir Koperasi) */}
        <section>
          <CooperativeWorkflowBanner />
        </section>
      </div>
    </div>
  );
}
