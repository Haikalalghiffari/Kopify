import { db } from "@/lib/db";
import {
  createOrder,
  confirmOrder,
  advanceOrder,
  completeOrder,
} from "@/services/orderService";

async function main() {
  const member = await db.member.findFirstOrThrow({ where: { memberNo: "ANG-0001" } });
  const kasir = await db.user.findFirstOrThrow({ where: { username: "kasir" } });
  const product = await db.product.findFirstOrThrow({ where: { sku: "BRG-0001" } });

  const show = async (label: string) => {
    const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    console.log("HASIL |", label, "-> stock:", p.stock, "reserved:", p.reservedStock);
  };

  await show("Awal");

  const order = await createOrder({
    memberId: member.id,
    items: [{ productId: product.id, qty: 2 }],
    createdBy: kasir.id,
  });
  console.log("HASIL | Pesanan dibuat:", order.orderNo, "total:", order.total);

  await confirmOrder(order.id, { userId: kasir.id });
  await show("Setelah konfirmasi");

  await advanceOrder(order.id, "DISIAPKAN", { userId: kasir.id });
  await advanceOrder(order.id, "SIAP_DIAMBIL", { userId: kasir.id });
  await completeOrder(order.id, { userId: kasir.id });
  await show("Setelah selesai");

  const sale = await db.sale.findUnique({
    where: { orderId: order.id },
    include: { saleItems: true },
  });
  console.log("HASIL | Penjualan:", sale?.saleNo, "item:", sale?.saleItems);
}

main()
  .catch((e) => console.error("GAGAL:", e))
  .finally(() => db.$disconnect());