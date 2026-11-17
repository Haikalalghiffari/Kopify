import { db } from "@/lib/db";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [orders, members, products] = await Promise.all([
    db.order.findMany({
      include: {
        member: true,
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.member.findMany({
      where: { deletedAt: null, status: "AKTIF" },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { deletedAt: null, isActive: true },
      include: { unit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <OrdersClient orders={orders} members={members} products={products} />;
}
