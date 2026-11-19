/**
 * P4 PostgreSQL integration — C) POS dengan reservasi aktif.
 * AMAN SECARA DEFAULT: di-skip kecuali RUN_P4_DB_INTEGRATION=1 + TEST_DATABASE_URL = koperasi_test_db.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db", async () => (await import("./support/safeDb")).dbMockModule());

import { advanceOrder, completeOrder, confirmOrder, createOrder } from "@/services/orderService";
import { createSale, SaleError } from "@/services/saleService";
import { getTestPrisma, isDbIntegrationEnabled } from "./support/safeDb";
import { FixtureTracker } from "./support/fixtures";

const d = isDbIntegrationEnabled() ? describe : describe.skip;

d("P4 POS with active reservations (PostgreSQL koperasi_test_db)", () => {
  let prisma: PrismaClient;
  let fx: FixtureTracker;

  beforeAll(() => {
    prisma = getTestPrisma();
    fx = new FixtureTracker(prisma);
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  async function setup(stock: number, reservedByOrder = 0) {
    const kasir = await fx.createUser({ role: "KASIR" });
    const member = await fx.createMember();
    const product = await fx.createProduct({ stock, costPrice: 6000, sellPrice: 10000 });
    let orderId: string | undefined;
    if (reservedByOrder > 0) {
      const order = await createOrder({
        memberId: member.id,
        items: [{ productId: product.id, qty: reservedByOrder }],
        createdBy: kasir.id,
      });
      fx.trackOrder(order.id);
      await confirmOrder(order.id, { userId: kasir.id });
      orderId = order.id;
    }
    return { kasir, member, product, orderId };
  }

  it("sells unreserved stock, records SALE movement, snapshots and audit", async () => {
    const { kasir, member, product } = await setup(10, 6); // available = 4

    const sale = await createSale({
      items: [{ productId: product.id, qty: 4 }],
      memberId: member.id,
      discount: 1000,
      paymentMethod: "TRANSFER",
      createdBy: kasir.id,
    });
    fx.trackSale(sale.id);

    expect(sale.saleNo).toMatch(/^SLS-\d{8}-\d{4,}$/);
    expect(sale).toMatchObject({
      total: 4 * 10000 - 1000,
      discount: 1000,
      paymentMethod: "TRANSFER",
      paymentStatus: "LUNAS", // non-BON default
      memberId: member.id,
      createdBy: kasir.id,
      orderId: null,
    });
    expect(sale.saleItems).toHaveLength(1);
    expect(sale.saleItems[0]).toMatchObject({ qty: 4, unitPrice: 10000, costPrice: 6000 });

    // stock fell, reservation untouched, invariant holds (stock 6 >= reserved 6)
    expect(await fx.stock(product.id)).toEqual({ stock: 6, reservedStock: 6 });

    const movements = await fx.movements(product.id);
    expect(movements).toHaveLength(1); // exactly one SALE movement, no duplicates
    expect(movements[0]).toMatchObject({
      type: "SALE",
      qtyChange: -4,
      stockBefore: 10,
      stockAfter: 6,
      refType: "SALE",
      refId: sale.id,
      createdBy: kasir.id,
    });

    const audits = await fx.audits("Sale", sale.id);
    expect(audits.map((a) => a.action)).toEqual(["CREATE_SALE"]);
    expect(audits[0].userId).toBe(kasir.id);
    await fx.assertInventoryInvariant();
  });

  it("cannot sell reserved stock, and leaves no trace when refused", async () => {
    const { kasir, product } = await setup(10, 6); // available = 4

    await expect(
      createSale({ items: [{ productId: product.id, qty: 5 }], createdBy: kasir.id })
    ).rejects.toBeInstanceOf(SaleError);

    expect(await fx.stock(product.id)).toEqual({ stock: 10, reservedStock: 6 });
    expect(await fx.movements(product.id)).toHaveLength(0);
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);
  });

  it("selling the last available unit blocks the next sale, and the reserved order can still complete", async () => {
    const { kasir, product, orderId } = await setup(10, 6);

    const ok = await createSale({ items: [{ productId: product.id, qty: 4 }], createdBy: kasir.id });
    fx.trackSale(ok.id);
    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }], createdBy: kasir.id })
    ).rejects.toBeInstanceOf(SaleError);

    // the reserved order was protected: it completes against the remaining 6 units
    await advanceOrder(orderId!, "DISIAPKAN", { userId: kasir.id });
    await advanceOrder(orderId!, "SIAP_DIAMBIL", { userId: kasir.id });
    await completeOrder(orderId!, { userId: kasir.id });

    expect(await fx.stock(product.id)).toEqual({ stock: 0, reservedStock: 0 });
    expect(await fx.movements(product.id)).toHaveLength(2); // 1 SALE + 1 ORDER_FULFILLED
    await fx.assertInventoryInvariant();
  });

  it("merges duplicate lines of the same product", async () => {
    const { kasir, product } = await setup(10);
    const sale = await createSale({
      items: [
        { productId: product.id, qty: 2 },
        { productId: product.id, qty: 3 },
      ],
      createdBy: kasir.id,
    });
    fx.trackSale(sale.id);
    expect(sale.saleItems).toHaveLength(1);
    expect(sale.saleItems[0].qty).toBe(5);
    expect(await fx.stock(product.id)).toEqual({ stock: 5, reservedStock: 0 });
    expect(await fx.movements(product.id)).toHaveLength(1);
  });

  it("BON requires a member and defaults to BELUM_LUNAS", async () => {
    const { kasir, member, product } = await setup(10);

    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }], paymentMethod: "BON", createdBy: kasir.id })
    ).rejects.toThrow(/BON hanya untuk anggota/);
    expect(await fx.stock(product.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);

    const sale = await createSale({
      items: [{ productId: product.id, qty: 1 }],
      memberId: member.id,
      paymentMethod: "BON",
      createdBy: kasir.id,
    });
    fx.trackSale(sale.id);
    expect(sale).toMatchObject({ paymentMethod: "BON", paymentStatus: "BELUM_LUNAS" });
  });

  it("[characterization] the service does not force BON to BELUM_LUNAS when a status is passed explicitly", async () => {
    // PRD only says BON is a credit sale; the UI forces BELUM_LUNAS but the server accepts an explicit status.
    // Recorded here so a future decision (enforce vs allow) is a conscious change.
    const { kasir, member, product } = await setup(10);
    const sale = await createSale({
      items: [{ productId: product.id, qty: 1 }],
      memberId: member.id,
      paymentMethod: "BON",
      paymentStatus: "LUNAS",
      createdBy: kasir.id,
    });
    fx.trackSale(sale.id);
    expect(sale.paymentStatus).toBe("LUNAS");
  });

  it("rejects inactive members, bad discounts, bad quantities and unknown actors without side effects", async () => {
    const { kasir, product } = await setup(10);
    const inactive = await fx.createMember("NONAKTIF");

    const baseline = async () => {
      expect(await fx.stock(product.id)).toEqual({ stock: 10, reservedStock: 0 });
      expect(await fx.movements(product.id)).toHaveLength(0);
      expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);
    };

    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }], memberId: inactive.id, createdBy: kasir.id })
    ).rejects.toThrow(/tidak ditemukan atau tidak aktif/);
    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }], discount: 10001, createdBy: kasir.id })
    ).rejects.toThrow(/Diskon tidak boleh/);
    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }], discount: -1, createdBy: kasir.id })
    ).rejects.toBeInstanceOf(SaleError);
    await expect(
      createSale({ items: [{ productId: product.id, qty: 0 }], createdBy: kasir.id })
    ).rejects.toBeInstanceOf(SaleError);
    await expect(createSale({ items: [], createdBy: kasir.id })).rejects.toBeInstanceOf(SaleError);
    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }] /* no actor */ })
    ).rejects.toThrow(/Sesi tidak valid/);
    await baseline();
  });

  it("does not sell inactive products", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const product = await fx.createProduct({ stock: 10, isActive: false });
    await expect(
      createSale({ items: [{ productId: product.id, qty: 1 }], createdBy: kasir.id })
    ).rejects.toThrow(/tidak tersedia/);
    expect(await fx.stock(product.id)).toEqual({ stock: 10, reservedStock: 0 });
  });

  it("a multi-item sale where a later item is short of stock rolls back every item", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const a = await fx.createProduct({ stock: 10 });
    const b = await fx.createProduct({ stock: 1 });

    await expect(
      createSale({
        items: [
          { productId: a.id, qty: 3 },
          { productId: b.id, qty: 2 },
        ],
        createdBy: kasir.id,
      })
    ).rejects.toBeInstanceOf(SaleError);

    expect(await fx.stock(a.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.stock(b.id)).toEqual({ stock: 1, reservedStock: 0 });
    expect(await fx.movements(a.id)).toHaveLength(0);
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);
  });
});
