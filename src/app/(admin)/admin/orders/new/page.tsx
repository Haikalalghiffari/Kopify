import Link from "next/link";
import { db } from "@/lib/db";
import NewOrderClient from "@/components/admin/NewOrderClient";

export const dynamic = "force-dynamic";

/** FR-5.9: kasir/admin membuat pesanan atas nama anggota (mis. pesan lewat telepon). */
export default async function NewOrderPage() {
  const [products, members] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      include: { unit: true },
    }),
    db.member.findMany({
      where: { deletedAt: null, status: "AKTIF" },
      orderBy: { name: "asc" },
      select: { id: true, memberNo: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Buat Pesanan</h1>
        <Link
          href="/admin/orders"
          className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Kembali ke daftar pesanan
        </Link>
      </div>
      <NewOrderClient
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit.name,
          price: p.sellPrice,
          available: p.stock - p.reservedStock,
        }))}
        members={members}
      />
    </div>
  );
}