import { db } from "@/lib/db";
import SalesClient from "./SalesClient";

export const dynamic = "force-dynamic";

export default async function AdminSalesPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [products, members, categories, recentSales] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null, isActive: true },
      include: { unit: true },
      orderBy: { name: "asc" },
    }),
    db.member.findMany({
      where: { deletedAt: null, status: "AKTIF" },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    db.sale.findMany({
      where: {
        soldAt: {
          gte: today,
        },
      },
      include: {
        member: true,
        createdBy: true,
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
      },
      orderBy: { soldAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <SalesClient
      products={products}
      members={members}
      categories={categories}
      recentSales={recentSales}
    />
  );
}
