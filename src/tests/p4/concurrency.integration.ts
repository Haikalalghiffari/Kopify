/**
 * P4 PostgreSQL integration — E) konkurensi.
 *
 * Menjalankan transaksi paralel nyata terhadap stok terbatas dan nomor dokumen bersama.
 * Setiap kegagalan yang BUKAN OrderError/SaleError (mis. deadlock, timeout, P2002) dianggap bug.
 *
 * AMAN SECARA DEFAULT: di-skip kecuali RUN_P4_DB_INTEGRATION=1 + TEST_DATABASE_URL = koperasi_test_db.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db", async () => (await import("./support/safeDb")).dbMockModule());

import {
  advanceOrder,
  completeOrder,
  confirmOrder,
  createOrder,
  OrderError,
} from "@/services/orderService";
import { createSale, SaleError } from "@/services/saleService";
import { getTestPrisma, isDbIntegrationEnabled } from "./support/safeDb";
import { FixtureTracker } from "./support/fixtures";

const d = isDbIntegrationEnabled() ? describe : describe.skip;

function outcome(results: PromiseSettledResult<unknown>[]) {
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  return { fulfilled, rejected };
}

/** Penolakan yang sah (aturan bisnis), bukan kegagalan infrastruktur seperti deadlock/timeout. */
function allBusinessRejections(rejected: PromiseRejectedResult[]) {
  return rejected.every((r) => r.reason instanceof OrderError || r.reason instanceof SaleError);
}

const suffix = (no: string) => Number(no.split("-")[2]);

d("P4 concurrency (PostgreSQL koperasi_test_db)", () => {
  let prisma: PrismaClient;
  let fx: FixtureTracker;

  beforeAll(() => {
    prisma = getTestPrisma();
    fx = new FixtureTracker(prisma);
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  async function newOrder(memberId: string, kasirId: string, productId: string, qty: number) {
    const o = await createOrder({ memberId, items: [{ productId, qty }], createdBy: kasirId });
    fx.trackOrder(o.id);
    return o;
  }

  async function readyOrder(memberId: string, kasirId: string, productId: string, qty: number) {
    const o = await newOrder(memberId, kasirId, productId, qty);
    await confirmOrder(o.id, { userId: kasirId });
    await advanceOrder(o.id, "DISIAPKAN", { userId: kasirId });
    await advanceOrder(o.id, "SIAP_DIAMBIL", { userId: kasirId });
    return o;
  }

  // ===================================================================
  // No overselling
  // ===================================================================
  describe("stock safety", () => {
    it("parallel confirmations of different orders cannot reserve more than available", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 7 });
      // each order is individually valid (available 7 >= 2) at creation time
      const orders = [];
      for (let i = 0; i < 6; i++) orders.push(await newOrder(member.id, kasir.id, p.id, 2));

      const { fulfilled, rejected } = outcome(
        await Promise.allSettled(orders.map((o) => confirmOrder(o.id, { userId: kasir.id })))
      );

      expect(fulfilled).toBe(3); // floor(7 / 2)
      expect(rejected).toHaveLength(3);
      expect(allBusinessRejections(rejected)).toBe(true);
      expect(await fx.stock(p.id)).toEqual({ stock: 7, reservedStock: 6 });
      expect(
        await prisma.stockReservation.count({ where: { productId: p.id, status: "ACTIVE" } })
      ).toBe(3);
      await fx.assertInventoryInvariant();
    });

    it("duplicate parallel confirmation of the SAME order reserves exactly once", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 10 });
      const order = await newOrder(member.id, kasir.id, p.id, 4);

      const { fulfilled, rejected } = outcome(
        await Promise.allSettled(Array.from({ length: 5 }, () => confirmOrder(order.id, { userId: kasir.id })))
      );

      expect(fulfilled).toBe(1);
      expect(allBusinessRejections(rejected)).toBe(true);
      expect(await fx.reservations(order.id)).toHaveLength(1);
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 4 });
      expect((await fx.audits("Order", order.id)).filter((a) => a.action === "CONFIRM_ORDER")).toHaveLength(1);
    });

    it("parallel POS sales cannot oversell limited stock", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const p = await fx.createProduct({ stock: 5 });

      const { fulfilled, rejected } = outcome(
        await Promise.allSettled(
          Array.from({ length: 4 }, () => createSale({ items: [{ productId: p.id, qty: 2 }], createdBy: kasir.id }))
        )
      );

      expect(fulfilled).toBe(2); // floor(5 / 2)
      expect(rejected).toHaveLength(2);
      expect(allBusinessRejections(rejected)).toBe(true);
      expect(await fx.stock(p.id)).toEqual({ stock: 1, reservedStock: 0 });

      const sales = await fx.salesCreatedBy(kasir.id);
      expect(sales).toHaveLength(2);
      const movements = await fx.movements(p.id);
      expect(movements).toHaveLength(2); // exactly one SALE movement per sale
      expect(movements.every((m) => m.type === "SALE" && m.qtyChange === -2)).toBe(true);
      expect(new Set(sales.map((s) => s.saleNo)).size).toBe(2);
    });

    it("parallel POS sales respect stock already reserved by a confirmed order", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 5 });
      const order = await newOrder(member.id, kasir.id, p.id, 2);
      await confirmOrder(order.id, { userId: kasir.id }); // available = 3

      const { fulfilled, rejected } = outcome(
        await Promise.allSettled(
          Array.from({ length: 5 }, () => createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id }))
        )
      );

      expect(fulfilled).toBe(3);
      expect(allBusinessRejections(rejected)).toBe(true);
      expect(await fx.stock(p.id)).toEqual({ stock: 2, reservedStock: 2 }); // reserved units untouched
      await fx.assertInventoryInvariant();
    });

    it("confirm vs POS racing for the last unit: exactly one wins, invariants hold", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 1 });
      const order = await newOrder(member.id, kasir.id, p.id, 1);

      const results = await Promise.allSettled([
        confirmOrder(order.id, { userId: kasir.id }),
        createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id }),
      ]);
      const { fulfilled, rejected } = outcome(results);

      expect(fulfilled).toBe(1);
      expect(allBusinessRejections(rejected)).toBe(true);
      const s = await fx.stock(p.id);
      expect(s.stock - s.reservedStock).toBeGreaterThanOrEqual(0);
      expect([
        { stock: 1, reservedStock: 1 }, // confirm won
        { stock: 0, reservedStock: 0 }, // POS won
      ]).toContainEqual(s);
      await fx.assertInventoryInvariant();
    });

    it("parallel completion of the SAME order commits stock and creates the Sale exactly once", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 20 });
      const order = await readyOrder(member.id, kasir.id, p.id, 3);

      const { fulfilled, rejected } = outcome(
        await Promise.allSettled(
          Array.from({ length: 5 }, () =>
            completeOrder(order.id, { userId: kasir.id, paymentMethod: "TUNAI", paymentStatus: "LUNAS" })
          )
        )
      );

      expect(fulfilled).toBe(1);
      expect(rejected).toHaveLength(4);
      expect(allBusinessRejections(rejected)).toBe(true);

      expect(await fx.salesOfOrder(order.id)).toHaveLength(1); // no duplicate Sale
      expect(await fx.countReservations(order.id, "COMMITTED")).toBe(1); // no duplicate committed reservation
      expect(await fx.countReservations(order.id, "ACTIVE")).toBe(0);
      expect(await fx.stock(p.id)).toEqual({ stock: 17, reservedStock: 0 }); // decreased once
      const movements = await fx.movements(p.id);
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe("ORDER_FULFILLED");
      expect((await fx.audits("Order", order.id)).filter((a) => a.action === "COMPLETE_ORDER")).toHaveLength(1);
      await fx.assertInventoryInvariant();
    });

    it("parallel POS sales with reversed line order do not deadlock", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const a = await fx.createProduct({ stock: 10 });
      const b = await fx.createProduct({ stock: 10 });

      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          createSale({
            items:
              i % 2 === 0
                ? [
                    { productId: a.id, qty: 1 },
                    { productId: b.id, qty: 1 },
                  ]
                : [
                    { productId: b.id, qty: 1 },
                    { productId: a.id, qty: 1 },
                  ],
            createdBy: kasir.id,
          })
        )
      );
      const { fulfilled, rejected } = outcome(results);

      expect(rejected.map((r) => String(r.reason))).toEqual([]); // no deadlock / timeout
      expect(fulfilled).toBe(6);
      expect(await fx.stock(a.id)).toEqual({ stock: 4, reservedStock: 0 });
      expect(await fx.stock(b.id)).toEqual({ stock: 4, reservedStock: 0 });
    });
  });

  // ===================================================================
  // Document numbering
  // ===================================================================
  describe("document numbering", () => {
    it("parallel order creation yields unique ORD numbers", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 1000 });

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id })
        )
      );
      expect(outcome(results).rejected.map((r) => String(r.reason))).toEqual([]);

      const orders = results.map((r) => (r as PromiseFulfilledResult<{ id: string; orderNo: string }>).value);
      orders.forEach((o) => fx.trackOrder(o.id));
      const numbers = orders.map((o) => o.orderNo);
      expect(new Set(numbers).size).toBe(8);
      numbers.forEach((n) => expect(n).toMatch(/^ORD-\d{8}-\d{4,}$/));
      // a contiguous block: no accidental skips among numbers issued in this burst
      const seq = numbers.map(suffix).sort((x, y) => x - y);
      expect(seq[seq.length - 1] - seq[0]).toBe(7);
    });

    it("parallel POS sales yield unique SLS numbers", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const p = await fx.createProduct({ stock: 1000 });

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id }))
      );
      expect(outcome(results).rejected.map((r) => String(r.reason))).toEqual([]);

      const numbers = results.map((r) => (r as PromiseFulfilledResult<{ saleNo: string }>).value.saleNo);
      expect(new Set(numbers).size).toBe(8);
      numbers.forEach((n) => expect(n).toMatch(/^SLS-\d{8}-\d{4,}$/));
    });

    it("order-generated and POS sales share one collision-free SLS sequence", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 1000 });
      const ready = [];
      for (let i = 0; i < 4; i++) ready.push(await readyOrder(member.id, kasir.id, p.id, 1));

      const tasks: Promise<unknown>[] = [
        ...ready.map((o) => completeOrder(o.id, { userId: kasir.id })),
        ...Array.from({ length: 4 }, () => createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id })),
      ];
      const { fulfilled, rejected } = outcome(await Promise.allSettled(tasks));

      expect(rejected.map((r) => String(r.reason))).toEqual([]);
      expect(fulfilled).toBe(8);

      const fromOrders = (await Promise.all(ready.map((o) => fx.salesOfOrder(o.id)))).flat();
      const fromPos = await prisma.sale.findMany({ where: { createdBy: kasir.id, orderId: null } });
      const numbers = [...fromOrders, ...fromPos].map((s) => s.saleNo);
      expect(numbers).toHaveLength(8);
      expect(new Set(numbers).size).toBe(8);
      await fx.assertInventoryInvariant();
    });

    it("keeps issuing unique ORD numbers after a gap (deleted row in the middle)", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const member = await fx.createMember();
      const p = await fx.createProduct({ stock: 100 });

      const o1 = await newOrder(member.id, kasir.id, p.id, 1);
      const o2 = await newOrder(member.id, kasir.id, p.id, 1);
      const o3 = await newOrder(member.id, kasir.id, p.id, 1);
      await prisma.order.delete({ where: { id: o2.id } }); // create a hole: ..., N, (N+1 missing), N+2

      // a COUNT(*)+1 scheme would now re-issue N+2 and violate UNIQUE(order_no)
      const o4 = await newOrder(member.id, kasir.id, p.id, 1);

      expect(o4.orderNo).not.toBe(o1.orderNo);
      expect(o4.orderNo).not.toBe(o3.orderNo);
      expect(suffix(o4.orderNo)).toBe(suffix(o3.orderNo) + 1);
    });

    it("keeps issuing unique SLS numbers after a gap (deleted sale in the middle)", async () => {
      const kasir = await fx.createUser({ role: "KASIR" });
      const p = await fx.createProduct({ stock: 100 });

      const s1 = await createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id });
      const s2 = await createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id });
      const s3 = await createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id });
      [s1, s2, s3].forEach((s) => fx.trackSale(s.id));
      await prisma.sale.delete({ where: { id: s2.id } });

      const s4 = await createSale({ items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id });
      fx.trackSale(s4.id);

      expect(s4.saleNo).not.toBe(s1.saleNo);
      expect(s4.saleNo).not.toBe(s3.saleNo);
      expect(suffix(s4.saleNo)).toBe(suffix(s3.saleNo) + 1);
    });
  });
});
