/**
 * P4 PostgreSQL integration — A) siklus pesanan penuh, B) penolakan & pembatalan.
 *
 * AMAN SECARA DEFAULT: suite di-skip kecuali RUN_P4_DB_INTEGRATION=1 dan TEST_DATABASE_URL
 * menunjuk tepat ke koperasi_test_db (lihat support/safeDb.ts).
 * Jalankan hanya lewat: npm run test:p4:integration  (setelah izin eksplisit).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db", async () => (await import("./support/safeDb")).dbMockModule());

import {
  advanceOrder,
  cancelOrder,
  completeOrder,
  confirmOrder,
  createOrder,
  OrderError,
  OrderNotFoundError,
  rejectOrder,
} from "@/services/orderService";
import { getTestPrisma, isDbIntegrationEnabled } from "./support/safeDb";
import { FixtureTracker } from "./support/fixtures";

const d = isDbIntegrationEnabled() ? describe : describe.skip;

d("P4 order lifecycle (PostgreSQL koperasi_test_db)", () => {
  let prisma: PrismaClient;
  let fx: FixtureTracker;

  beforeAll(() => {
    prisma = getTestPrisma();
    fx = new FixtureTracker(prisma);
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  async function actors() {
    const kasir = await fx.createUser({ role: "KASIR" });
    const member = await fx.createMember();
    return { kasir, member };
  }

  /** Pesanan dikonfirmasi lewat service (reservasi nyata). */
  async function confirmedOrder(
    memberId: string,
    kasirId: string,
    lines: { productId: string; qty: number }[]
  ) {
    const order = await createOrder({ memberId, items: lines, createdBy: kasirId });
    fx.trackOrder(order.id);
    await confirmOrder(order.id, { userId: kasirId });
    return order;
  }

  // ===================================================================
  // A. FULL ORDER LIFECYCLE
  // ===================================================================
  describe("A. full order lifecycle", () => {
    it("create -> confirm -> prepare -> ready -> complete with exact stock accounting", async () => {
      const { kasir, member } = await actors();
      const p1 = await fx.createProduct({ stock: 20, costPrice: 6000, sellPrice: 10000 });
      const p2 = await fx.createProduct({ stock: 10, costPrice: 3000, sellPrice: 5000 });

      // 1-2. create + verify order & items
      const order = await createOrder({
        memberId: member.id,
        items: [
          { productId: p1.id, qty: 3 },
          { productId: p2.id, qty: 2 },
        ],
        note: "ambil sore",
        createdBy: kasir.id,
      });
      fx.trackOrder(order.id);

      expect(order.orderNo).toMatch(/^ORD-\d{8}-\d{4,}$/);
      expect(order.status).toBe("DIAJUKAN");
      expect(order.total).toBe(3 * 10000 + 2 * 5000);
      expect(order.orderItems).toHaveLength(2);
      const byProduct = new Map(order.orderItems.map((i) => [i.productId, i]));
      expect(byProduct.get(p1.id)).toMatchObject({ qty: 3, unitPrice: 10000 });
      expect(byProduct.get(p2.id)).toMatchObject({ qty: 2, unitPrice: 5000 });
      // creating an order must NOT reserve anything yet
      expect(await fx.stock(p1.id)).toEqual({ stock: 20, reservedStock: 0 });
      expect(await fx.reservations(order.id)).toHaveLength(0);

      // 3-5. confirm -> ACTIVE reservations, reservedStock increased
      const confirmed = await confirmOrder(order.id, { userId: kasir.id });
      expect(confirmed.status).toBe("DIKONFIRMASI");
      const res = await fx.reservations(order.id);
      expect(res).toHaveLength(2);
      for (const r of res) {
        expect(r.status).toBe("ACTIVE");
        expect(r.remainingQty).toBe(r.qty);
      }
      expect(await fx.stock(p1.id)).toEqual({ stock: 20, reservedStock: 3 });
      expect(await fx.stock(p2.id)).toEqual({ stock: 10, reservedStock: 2 });

      // duplicate confirmation must not double-reserve
      await expect(confirmOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      expect(await fx.reservations(order.id)).toHaveLength(2);
      expect(await fx.stock(p1.id)).toEqual({ stock: 20, reservedStock: 3 });

      // 6-7. advance
      expect((await advanceOrder(order.id, "DISIAPKAN", { userId: kasir.id })).status).toBe(
        "DISIAPKAN"
      );
      expect((await advanceOrder(order.id, "SIAP_DIAMBIL", { userId: kasir.id })).status).toBe(
        "SIAP_DIAMBIL"
      );
      // advancing does not touch stock
      expect(await fx.stock(p1.id)).toEqual({ stock: 20, reservedStock: 3 });

      // prices change after ordering: order keeps its unit-price snapshot,
      // sale cost snapshot is taken from the product at completion time
      await prisma.product.update({ where: { id: p1.id }, data: { costPrice: 6500, sellPrice: 12000 } });

      // 8. complete with payment
      const done = await completeOrder(order.id, {
        userId: kasir.id,
        paymentMethod: "TRANSFER",
        paymentStatus: "BELUM_LUNAS",
      });
      expect(done.status).toBe("SELESAI");

      // 9. reservations COMMITTED
      const after = await fx.reservations(order.id);
      expect(after.map((r) => r.status)).toEqual(["COMMITTED", "COMMITTED"]);
      expect(after.every((r) => r.remainingQty === 0)).toBe(true);

      // 10-11. physical stock decreased exactly once, reservedStock released
      expect(await fx.stock(p1.id)).toEqual({ stock: 17, reservedStock: 0 });
      expect(await fx.stock(p2.id)).toEqual({ stock: 8, reservedStock: 0 });

      // 12-13. exactly one Sale with snapshots
      const sales = await fx.salesOfOrder(order.id);
      expect(sales).toHaveLength(1);
      const sale = sales[0];
      expect(sale.saleNo).toMatch(/^SLS-\d{8}-\d{4,}$/);
      expect(sale).toMatchObject({
        total: 40000,
        discount: 0,
        paymentMethod: "TRANSFER",
        paymentStatus: "BELUM_LUNAS",
        memberId: member.id,
        createdBy: kasir.id,
      });
      expect(sale.saleItems).toHaveLength(2);
      const items = new Map(sale.saleItems.map((i) => [i.productId, i]));
      expect(items.get(p1.id)).toMatchObject({ qty: 3, unitPrice: 10000, costPrice: 6500 });
      expect(items.get(p2.id)).toMatchObject({ qty: 2, unitPrice: 5000, costPrice: 3000 });

      // 14. exactly one stock movement per mutation, no stray SALE movement
      const m1 = await fx.movements(p1.id);
      expect(m1).toHaveLength(1);
      expect(m1[0]).toMatchObject({
        type: "ORDER_FULFILLED",
        qtyChange: -3,
        stockBefore: 20,
        stockAfter: 17,
        refType: "ORDER",
        refId: order.id,
        createdBy: kasir.id,
      });
      const m2 = await fx.movements(p2.id);
      expect(m2).toHaveLength(1);
      expect(m2[0]).toMatchObject({ type: "ORDER_FULFILLED", qtyChange: -2, stockBefore: 10, stockAfter: 8 });

      // 15. audit trail (P4-owned Order audits), attributed to the real actor
      const audits = await fx.audits("Order", order.id);
      expect(audits.map((a) => a.action)).toEqual([
        "CREATE_ORDER",
        "CONFIRM_ORDER",
        "ADVANCE_ORDER",
        "ADVANCE_ORDER",
        "COMPLETE_ORDER",
      ]);
      expect(audits.every((a) => a.userId === kasir.id)).toBe(true);
      expect(audits[4].detailJson).toMatchObject({
        saleNo: sale.saleNo,
        paymentMethod: "TRANSFER",
        paymentStatus: "BELUM_LUNAS",
      });

      // duplicate completion must change nothing
      await expect(completeOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      expect(await fx.salesOfOrder(order.id)).toHaveLength(1);
      expect(await fx.stock(p1.id)).toEqual({ stock: 17, reservedStock: 0 });
      expect(await fx.movements(p1.id)).toHaveLength(1);
      await fx.assertInventoryInvariant();
    });

    it("rejects an invalid state jump without side effects", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 10 });
      const order = await createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id });
      fx.trackOrder(order.id);

      await expect(advanceOrder(order.id, "SIAP_DIAMBIL", { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      await expect(completeOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
      expect(await fx.salesOfOrder(order.id)).toHaveLength(0);
    });

    it("refuses to create an order that exceeds available (stock - reserved) stock", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 5, reservedStock: 3 });
      await expect(
        createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 3 }], createdBy: kasir.id })
      ).rejects.toBeInstanceOf(OrderError);
    });
  });

  // ===================================================================
  // B. REJECTION AND CANCELLATION (only transitions the state machine permits)
  // ===================================================================
  describe("B. rejection and cancellation", () => {
    it("reject from DIAJUKAN: nothing was reserved, nothing to release", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 10 });
      const order = await createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 4 }], createdBy: kasir.id });
      fx.trackOrder(order.id);

      const rejected = await rejectOrder(order.id, "  barang ditarik  ", { userId: kasir.id });
      expect(rejected.status).toBe("DITOLAK");
      expect(rejected.rejectReason).toBe("barang ditarik");
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
      expect(await fx.reservations(order.id)).toHaveLength(0);
      expect(await fx.salesOfOrder(order.id)).toHaveLength(0);
      expect((await fx.audits("Order", order.id)).map((a) => a.action)).toEqual([
        "CREATE_ORDER",
        "REJECT_ORDER",
      ]);
    });

    it("reject from DIKONFIRMASI releases the reservation; duplicate reject cannot corrupt stock", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 10 });
      const order = await confirmedOrder(member.id, kasir.id, [{ productId: p.id, qty: 4 }]);
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 4 });

      await rejectOrder(order.id, "stok rusak", { userId: kasir.id });

      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
      const res = await fx.reservations(order.id);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ status: "RELEASED", remainingQty: 0 });
      expect(await fx.salesOfOrder(order.id)).toHaveLength(0);
      expect(await fx.movements(p.id)).toHaveLength(0); // release is not a stock movement

      // duplicate release attempts
      await expect(rejectOrder(order.id, "lagi", { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      await expect(cancelOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 }); // not negative
      expect(await fx.reservations(order.id)).toHaveLength(1);
      await fx.assertInventoryInvariant();
    });

    it("staff cancel from DIAJUKAN and from DIKONFIRMASI", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 10 });

      const early = await createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 2 }], createdBy: kasir.id });
      fx.trackOrder(early.id);
      expect((await cancelOrder(early.id, { userId: kasir.id })).status).toBe("DIBATALKAN");
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });

      const late = await confirmedOrder(member.id, kasir.id, [{ productId: p.id, qty: 5 }]);
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 5 });
      expect((await cancelOrder(late.id, { userId: kasir.id })).status).toBe("DIBATALKAN");
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 0 });
      expect((await fx.reservations(late.id)).map((r) => r.status)).toEqual(["RELEASED"]);
      expect(await fx.movements(p.id)).toHaveLength(0);
    });

    it("releases only the reservation that belongs to the cancelled order", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 20 });
      const o1 = await confirmedOrder(member.id, kasir.id, [{ productId: p.id, qty: 2 }]);
      const o2 = await confirmedOrder(member.id, kasir.id, [{ productId: p.id, qty: 3 }]);
      expect(await fx.stock(p.id)).toEqual({ stock: 20, reservedStock: 5 });

      await cancelOrder(o1.id, { userId: kasir.id });

      expect(await fx.stock(p.id)).toEqual({ stock: 20, reservedStock: 3 });
      expect((await fx.reservations(o2.id)).map((r) => [r.status, r.remainingQty])).toEqual([["ACTIVE", 3]]);
      await fx.assertInventoryInvariant();
    });

    it("member can cancel only their own DIAJUKAN order", async () => {
      const { kasir, member } = await actors();
      const other = await fx.createMember();
      const p = await fx.createProduct({ stock: 10 });

      const mine = await createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 1 }] });
      fx.trackOrder(mine.id);

      // another member: indistinguishable from "not found"
      await expect(cancelOrder(mine.id, { memberId: other.id })).rejects.toBeInstanceOf(OrderNotFoundError);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("DIAJUKAN");

      // owner can cancel while DIAJUKAN
      expect((await cancelOrder(mine.id, { memberId: member.id })).status).toBe("DIBATALKAN");

      // once confirmed, the member may no longer cancel; reservation stays intact
      const confirmed = await confirmedOrder(member.id, kasir.id, [{ productId: p.id, qty: 2 }]);
      await expect(cancelOrder(confirmed.id, { memberId: member.id })).rejects.toThrow(/DIAJUKAN/);
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 2 });
      expect((await fx.reservations(confirmed.id))[0].status).toBe("ACTIVE");

      // the member cancel is attributed in the audit log by member only (no staff user)
      const audits = await fx.audits("Order", mine.id);
      expect(audits.map((a) => a.action)).toEqual(["CREATE_ORDER", "CANCEL_ORDER"]);
      expect(audits[1].detailJson).toMatchObject({ cancelledBy: "MEMBER", memberId: member.id });
    });

    it("state machine: DISIAPKAN / SIAP_DIAMBIL can no longer be cancelled or rejected", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 10 });
      const order = await confirmedOrder(member.id, kasir.id, [{ productId: p.id, qty: 3 }]);

      await advanceOrder(order.id, "DISIAPKAN", { userId: kasir.id });
      await expect(cancelOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);
      await expect(rejectOrder(order.id, "x", { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);

      await advanceOrder(order.id, "SIAP_DIAMBIL", { userId: kasir.id });
      await expect(cancelOrder(order.id, { userId: kasir.id })).rejects.toBeInstanceOf(OrderError);

      // reservation intact, no sale
      expect(await fx.stock(p.id)).toEqual({ stock: 10, reservedStock: 3 });
      expect((await fx.reservations(order.id))[0].status).toBe("ACTIVE");
      expect(await fx.salesOfOrder(order.id)).toHaveLength(0);
    });

    it("requires a staff actor and a rejection reason", async () => {
      const { kasir, member } = await actors();
      const p = await fx.createProduct({ stock: 10 });
      const order = await createOrder({ memberId: member.id, items: [{ productId: p.id, qty: 1 }], createdBy: kasir.id });
      fx.trackOrder(order.id);

      await expect(rejectOrder(order.id, "   ", { userId: kasir.id })).rejects.toThrow(/Alasan/);
      await expect(confirmOrder(order.id, { userId: "" })).rejects.toThrow(/Sesi tidak valid/);
      await expect(cancelOrder(order.id, {})).rejects.toThrow(/Sesi tidak valid/);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DIAJUKAN");
    });
  });
});
