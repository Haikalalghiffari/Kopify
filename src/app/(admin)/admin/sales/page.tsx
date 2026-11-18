import { db } from "@/lib/db";
import PosClient from "@/components/admin/PosClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
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
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">Kasir (POS)</h1>
      <PosClient
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