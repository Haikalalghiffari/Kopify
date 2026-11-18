/**
 * P4 PostgreSQL integration — D) rollback atomik.
 *
 * Kegagalan disuntikkan pada batas transaksi yang valid, lalu diverifikasi bahwa TIDAK ADA
 * sisa parsial (stok, reservasi, movement, sale, audit) yang tertinggal.
 *
 * AMAN SECARA DEFAULT: di-skip kecuali RUN_P4_DB_INTEGRATION=1 + TEST_DATABASE_URL = koperasi_test_db.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db", async () => (await import("./support/safeDb")).dbMockModule());

// Pembungkus yang meneruskan ke implementasi asli, kecuali dipaksa gagal lewat *Once.
vi.mock("@/services/documentNumber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/documentNumber")>();
  return { ...actual, nextDocumentNumber: vi.fn(actual.nextDocumentNumber) };
});
vi.mock("@/services/p4Audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/p4Audit")>();
  return {
    ...actual,
    auditOrderAction: vi.fn(actual.auditOrderAction),
    auditSaleAction: vi.fn(actual.auditSaleAction),
  };
});

import {
  advanceOrder,
  completeOrder,
  confirmOrder,
  createOrder,
  OrderError,
} from "@/services/orderService";
import { createSale, SaleError } from "@/services/saleService";
import { nextDocumentNumber } from "@/services/documentNumber";
import { auditOrderAction, auditSaleAction } from "@/services/p4Audit";
import { stockService } from "@/services/stockService";
import { getTestPrisma, isDbIntegrationEnabled } from "./support/safeDb";
import { FixtureTracker, sortIds } from "./support/fixtures";

const d = isDbIntegrationEnabled() ? describe : describe.skip;

d("P4 atomic rollback (PostgreSQL koperasi_test_db)", () => {
  let prisma: PrismaClient;
  let fx: FixtureTracker;

  beforeAll(() => {
    prisma = getTestPrisma();
    fx = new FixtureTracker(prisma);
  });

  afterEach(async () => {
    vi.mocked(nextDocumentNumber).mockClear();
    vi.mocked(auditOrderAction).mockClear();
    vi.mocked(auditSaleAction).mockClear();
    await fx.cleanup();
  });

  /** Pesanan siap diambil (reservasi ACTIVE) lewat service. stock=20, reserved=3 setelahnya. */
  async function readyOrder() {
    const kasir = await fx.createUser({ role: "KASIR" });
    const member = await fx.createMember();
    const product = await fx.createProduct({ stock: 20, costPrice: 6000, sellPrice: 10000 });
    const order = await createOrder({
      memberId: member.id,
      items: [{ productId: product.id, qty: 3 }],
      createdBy: kasir.id,
    });
    fx.trackOrder(order.id);
    await confirmOrder(order.id, { userId: kasir.id });
    await advanceOrder(order.id, "DISIAPKAN", { userId: kasir.id });
    await advanceOrder(order.id, "SIAP_DIAMBIL", { userId: kasir.id });
    return { kasir, member, product, order };
  }

  async function expectOrderUntouchedAfterFailedCompletion(
    orderId: string,
    productId: string,
    expectedStock: { stock: number; reservedStock: number }
  ) {
    expect(await fx.stock(productId)).toEqual(expectedStock);
    expect(await fx.salesOfOrder(orderId)).toHaveLength(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("SIAP_DIAMBIL");
    expect((await fx.reservations(orderId)).map((r) => r.status)).toEqual(["ACTIVE"]);
    expect(await fx.movements(productId)).toHaveLength(0);
    expect((await fx.audits("Order", orderId)).map((a) => a.action)).not.toContain("COMPLETE_ORDER");
  }

  // ---------------------------------------------------------------
  // Reservation failure
  // ---------------------------------------------------------------
  it("confirmOrder: a later reservation failure rolls back the earlier reservation and the status", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const member = await fx.createMember();
    const a = await fx.createProduct({ stock: 10 });
    const b = await fx.createProduct({ stock: 5 });
    // the service reserves in sorted-id order: make the FIRST succeed and the SECOND fail
    const [firstId, secondId] = sortIds([a.id, b.id]);
    const order = await fx.createOrderRow({
      memberId: member.id,
      items: [
        { productId: firstId, qty: 2 },
        { productId: secondId, qty: 50 }, // far above stock 5
      ],
    });

    await expect(confirmOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);

    expect(await fx.stock(firstId)).toEqual({ stock: expect.any(Number), reservedStock: 0 });
    expect(await fx.stock(secondId)).toMatchObject({ reservedStock: 0 });
    expect(await fx.reservations(order.id)).toHaveLength(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DIAJUKAN");
    expect((await fx.audits("Order", order.id)).map((x) => x.action)).not.toContain("CONFIRM_ORDER");
    await fx.assertInventoryInvariant();
  });

  it("confirmOrder: failing audit write (last step) rolls back the reservations", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const member = await fx.createMember();
    const p = await fx.createProduct({ stock: 10 });
    const order = await createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 4 }], createdBy: kasir.id });
    fx.trackOrder(order.id);

    vi.mocked(auditOrderAction).mockRejectedValueOnce(new Error("simulated audit failure"));
    await expect(confirmOrder(order.id, { userId: kasir.id })).rejects.toThrow(/simulated audit failure/);

    expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.reservations(order.id)).toHaveLength(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DIAJUKAN");
  });

  // ---------------------------------------------------------------
  // Completion failures
  // ---------------------------------------------------------------
  it("completeOrder: no active reservation -> commit fails, no sale, order unchanged", async () => {
    const { kasir, product, order } = await readyOrder();
    await prisma.stockReservation.deleteMany({ where: { orderId: order.id } }); // simulate lost reservation

    await expect(completeOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);

    expect(await fx.stock(product.id)).toEqual({ stock: 20, reservedStock: 3 });
    expect(await fx.salesOfOrder(order.id)).toHaveLength(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SIAP_DIAMBIL");
    expect(await fx.movements(product.id)).toHaveLength(0);
  });

  it("completeOrder: inconsistent physical stock -> commit refused, nothing changes", async () => {
    const { kasir, product, order } = await readyOrder();
    await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } }); // < reserved qty 3

    await expect(completeOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);

    await expectOrderUntouchedAfterFailedCompletion(order.id, product.id, { stock: 1, reservedStock: 3 });
  });

  it("completeOrder: Sale creation fails AFTER stock was committed -> stock commit is rolled back", async () => {
    const { kasir, product, order } = await readyOrder();
    const existing = await fx.createSaleRow({ createdBy: kasir.id }); // occupies a saleNo
    vi.mocked(nextDocumentNumber).mockResolvedValueOnce(existing.saleNo); // forces UNIQUE violation on sales.sale_no

    await expect(completeOrder(order.id, { userId: kasir.id })).rejects.toThrow();

    await expectOrderUntouchedAfterFailedCompletion(order.id, product.id, { stock: 20, reservedStock: 3 });

    // the system stays recoverable: a clean retry succeeds exactly once
    await completeOrder(order.id, { userId: kasir.id });
    expect(await fx.stock(product.id)).toEqual({ stock: 17, reservedStock: 0 });
    expect(await fx.salesOfOrder(order.id)).toHaveLength(1);
    expect(await fx.movements(product.id)).toHaveLength(1);
  });

  it("completeOrder: failing audit write (last step) rolls back stock commit, sale and status", async () => {
    const { kasir, product, order } = await readyOrder();

    vi.mocked(auditOrderAction).mockRejectedValueOnce(new Error("simulated audit failure"));
    await expect(completeOrder(order.id, { userId: kasir.id })).rejects.toThrow(/simulated audit failure/);

    await expectOrderUntouchedAfterFailedCompletion(order.id, product.id, { stock: 20, reservedStock: 3 });
  });

  // ---------------------------------------------------------------
  // POS failures
  // ---------------------------------------------------------------
  it("createSale: stock adjustment fails on the 2nd item -> 1st item's movement, sale and items vanish", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const a = await fx.createProduct({ stock: 10 });
    const b = await fx.createProduct({ stock: 10 });

    const real = stockService.adjustStock.bind(stockService);
    let calls = 0;
    const spy = vi.spyOn(stockService, "adjustStock").mockImplementation(async (params, tx) => {
      calls += 1;
      if (calls === 2) throw new Error("simulated adjustStock failure");
      return real(params, tx);
    });

    try {
      await expect(
        createSale({
          items: [
            { productId: a.id, qty: 2 },
            { productId: b.id, qty: 2 },
          ],
          createdBy: kasir.id,
        })
      ).rejects.toThrow(/simulated adjustStock failure/);
    } finally {
      spy.mockRestore();
    }

    expect(calls).toBe(2); // the first adjustment really ran before the failure
    expect(await fx.stock(a.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.stock(b.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.movements(a.id)).toHaveLength(0);
    expect(await fx.movements(b.id)).toHaveLength(0);
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);
    expect(await prisma.saleItem.count({ where: { productId: { in: [a.id, b.id] } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { userId: kasir.id } })).toBe(0);
  });

  it("createSale: Sale creation fails (duplicate sale_no) -> no stock movement, no partial rows", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const p = await fx.createProduct({ stock: 10 });
    const existing = await fx.createSaleRow({ createdBy: kasir.id });
    vi.mocked(nextDocumentNumber).mockResolvedValueOnce(existing.saleNo);

    await expect(createSale({ items: [{ productId: p.id, qty: 3 }], createdBy: kasir.id })).rejects.toThrow();

    expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.movements(p.id)).toHaveLength(0);
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(1); // only the pre-existing one
  });

  it("createSale: failing audit write (last step) rolls back sale AND stock movement", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const p = await fx.createProduct({ stock: 10 });

    vi.mocked(auditSaleAction).mockRejectedValueOnce(new Error("simulated audit failure"));
    await expect(createSale({ items: [{ productId: p.id, qty: 3 }], createdBy: kasir.id })).rejects.toThrow(
      /simulated audit failure/
    );

    expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.movements(p.id)).toHaveLength(0);
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);
  });

  it("createSale: an unknown actor id violates a foreign key and rolls everything back", async () => {
    const p = await fx.createProduct({ stock: 10 });

    await expect(
      createSale({ items: [{ productId: p.id, qty: 3 }], createdBy: "no-such-user-id" })
    ).rejects.toThrow();

    expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
    expect(await fx.movements(p.id)).toHaveLength(0);
    expect(await prisma.sale.count({ where: { createdBy: "no-such-user-id" } })).toBe(0);
  });

  it("createSale: SaleError path (insufficient stock) is also fully atomic", async () => {
    const kasir = await fx.createUser({ role: "KASIR" });
    const p = await fx.createProduct({ stock: 2 });
    await expect(
      createSale({ items: [{ productId: p.id, qty: 3 }], createdBy: kasir.id })
    ).rejects.toBeInstanceOf(SaleError);
    expect(await fx.stock(p.id)).toEqual({ stock: 2, reservedStock: 0 });
    expect(await fx.salesCreatedBy(kasir.id)).toHaveLength(0);
  });
});
