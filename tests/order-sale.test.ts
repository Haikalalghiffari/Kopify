import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { createOrder, updateOrderStatus, cancelMemberOrder } from "../src/services/orderService";
import { createDirectSale } from "../src/services/saleService";

const db = new PrismaClient();

describe("Fase 3: AC 6.5 & AC 6.6 - Alur Pesanan Anggota & Penjualan Kasir", () => {
  let adminUser: any;
  let testMember: any;
  let otherMember: any;
  let testProduct: any;

  beforeAll(async () => {
    await db.$connect();

    adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
    const members = await db.member.findMany({ take: 2 });
    testMember = members[0];
    otherMember = members[1];

    const category = await db.category.findFirst();
    const unit = await db.unit.findFirst();

    testProduct = await db.product.create({
      data: {
        sku: "TEST-ORD-001",
        name: "Produk Uji Pesanan & Kasir",
        categoryId: category!.id,
        unitId: unit!.id,
        costPrice: 5000,
        sellPrice: 7500,
        stock: 30,
        reservedStock: 0,
        minStock: 5,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await db.saleItem.deleteMany({ where: { productId: testProduct.id } });
      await db.orderItem.deleteMany({ where: { productId: testProduct.id } });
      await db.stockMovement.deleteMany({ where: { productId: testProduct.id } });
      await db.product.delete({ where: { id: testProduct.id } });
    }
    await db.$disconnect();
  });

  it("FR-5.2 & AC 6.5: membuat pesanan anggota berstatus DIAJUKAN dengan nomor ORD-YYYYMMDD-XXXX", async () => {
    const order = await createOrder({
      memberId: testMember.id,
      createdById: adminUser.id,
      items: [{ productId: testProduct.id, qty: 5 }],
      note: "Pesanan uji coba vitest",
    });

    expect(order.orderNo).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(order.status).toBe(OrderStatus.DIAJUKAN);
    expect(order.total).toBe(7500 * 5);
    expect(order.items.length).toBe(1);

    // Stok fisik dan reserved belum berubah saat baru diajukan
    const p = await db.product.findUnique({ where: { id: testProduct.id } });
    expect(p?.stock).toBe(30);
    expect(p?.reservedStock).toBe(0);

    // Bersihkan order
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
  });

  it("FR-5.4: menolak pesanan jika kuantitas melebihi sisa stok tersedia", async () => {
    await expect(
      createOrder({
        memberId: testMember.id,
        createdById: adminUser.id,
        items: [{ productId: testProduct.id, qty: 50 }], // Stok hanya 30
      })
    ).rejects.toThrow("melebihi sisa stok yang tersedia");
  });

  it("AC 6.5: mengonfirmasi pesanan mencadangkan stok (reservedStock bertambah)", async () => {
    const order = await createOrder({
      memberId: testMember.id,
      createdById: adminUser.id,
      items: [{ productId: testProduct.id, qty: 8 }],
    });

    // Konfirmasi pesanan
    const confirmed = await updateOrderStatus({
      orderId: order.id,
      newStatus: OrderStatus.DIKONFIRMASI,
      userId: adminUser.id,
    });

    expect(confirmed.status).toBe(OrderStatus.DIKONFIRMASI);

    const p = await db.product.findUnique({ where: { id: testProduct.id } });
    expect(p?.reservedStock).toBe(8);
    expect(p?.stock).toBe(30); // stok fisik tetap 30, tapi 8 dicadangkan

    // Selesaikan alur hingga SELESAI
    await updateOrderStatus({
      orderId: order.id,
      newStatus: OrderStatus.DISIAPKAN,
      userId: adminUser.id,
    });

    await updateOrderStatus({
      orderId: order.id,
      newStatus: OrderStatus.SIAP_DIAMBIL,
      userId: adminUser.id,
    });

    const finished = await updateOrderStatus({
      orderId: order.id,
      newStatus: OrderStatus.SELESAI,
      userId: adminUser.id,
      paymentMethod: PaymentMethod.TUNAI,
    });

    expect(finished.status).toBe(OrderStatus.SELESAI);

    // Saat selesai: stok fisik berkurang dan reservedStock dilepas
    const pAfter = await db.product.findUnique({ where: { id: testProduct.id } });
    expect(pAfter?.stock).toBe(22); // 30 - 8
    expect(pAfter?.reservedStock).toBe(0);

    // Transaksi penjualan (Sale) otomatis tercatat
    const sale = await db.sale.findUnique({ where: { orderId: order.id } });
    expect(sale).not.toBeNull();
    expect(sale?.total).toBe(7500 * 8);

    // Pergerakan stok ORDER_FULFILLED tercatat
    const movement = await db.stockMovement.findFirst({
      where: { refId: order.id, type: "ORDER_FULFILLED" },
    });
    expect(movement).not.toBeNull();
    expect(movement?.qtyChange).toBe(-8);

    // Update state fixture
    testProduct.stock = 22;
  });

  it("FR-5.3: anggota dapat membatalkan pesanan selama status masih DIAJUKAN", async () => {
    const order = await createOrder({
      memberId: testMember.id,
      createdById: adminUser.id,
      items: [{ productId: testProduct.id, qty: 2 }],
    });

    // Anggota lain mencoba membatalkan harus ditolak
    await expect(
      cancelMemberOrder(order.id, otherMember.id, adminUser.id)
    ).rejects.toThrow("tidak memiliki hak untuk membatalkan pesanan ini");

    // Anggota yang tepat membatalkan
    const cancelled = await cancelMemberOrder(order.id, testMember.id, adminUser.id);
    expect(cancelled.status).toBe(OrderStatus.DIBATALKAN);
  });

  it("FR-6.1 & AC 6.6: transaksi kasir langsung (POS) memotong stok fisik dan mencatat nomor SLS-YYYYMMDD-XXXX", async () => {
    const initialStock = testProduct.stock; // 22

    const sale = await createDirectSale({
      memberId: null, // Pelanggan umum
      items: [{ productId: testProduct.id, qty: 5 }],
      discount: 2500,
      paymentMethod: PaymentMethod.TUNAI,
      paymentStatus: PaymentStatus.LUNAS,
      createdById: adminUser.id,
    });

    expect(sale.saleNo).toMatch(/^SLS-\d{8}-\d{4}$/);
    expect(sale.total).toBe(7500 * 5 - 2500); // 35.000

    // Stok berkurang otomatis
    const p = await db.product.findUnique({ where: { id: testProduct.id } });
    expect(p?.stock).toBe(initialStock - 5);

    // Pergerakan stok SALE tercatat
    const movement = await db.stockMovement.findFirst({
      where: { refId: sale.id, type: "SALE" },
    });
    expect(movement?.qtyChange).toBe(-5);
    expect(movement?.stockAfter).toBe(initialStock - 5);
  });
});
