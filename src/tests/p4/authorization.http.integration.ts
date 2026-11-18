/**
 * P4 PostgreSQL integration — F) otorisasi di level HTTP (route handler nyata).
 *
 * Handler Next.js dipanggil langsung dengan `Request` sungguhan; hanya sesi (next-auth) yang
 * di-mock. Service, database (koperasi_test_db), dan PDF adalah implementasi nyata.
 *
 * Catatan cakupan: perilaku middleware (redirect tanpa login -> /login, /unauthorized untuk
 * halaman, RBAC rute) berada SEBELUM handler dan hanya dapat diuji di E2E (Playwright).
 *
 * AMAN SECARA DEFAULT: di-skip kecuali RUN_P4_DB_INTEGRATION=1 + TEST_DATABASE_URL = koperasi_test_db.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => sessionRef.current) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", async () => (await import("./support/safeDb")).dbMockModule());

import { POST as postOrder } from "@/app/api/orders/route";
import { PATCH as patchOrder } from "@/app/api/orders/[id]/route";
import { POST as cancelOrderRoute } from "@/app/api/orders/[id]/cancel/route";
import { GET as getProof } from "@/app/api/orders/[id]/proof/route";
import { GET as getPendingCount } from "@/app/api/orders/pending-count/route";
import { POST as postSale } from "@/app/api/sales/route";
import { GET as getSalePdf } from "@/app/api/sales/[id]/pdf/route";
import { advanceOrder, completeOrder, confirmOrder, createOrder } from "@/services/orderService";
import { createSale } from "@/services/saleService";
import { getTestPrisma, isDbIntegrationEnabled } from "./support/safeDb";
import { FixtureTracker } from "./support/fixtures";

const d = isDbIntegrationEnabled() ? describe : describe.skip;

type Role = "ADMIN" | "KASIR" | "ANGGOTA";
const sess = (userId: string | undefined, role: Role, memberId?: string | null) => ({
  user: { id: userId, role, memberId: memberId ?? null, name: "p4-test" },
  expires: new Date(Date.now() + 3600_000).toISOString(),
});
const as = (s: unknown) => {
  sessionRef.current = s;
};

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: { id } });

async function isPdf(res: Response) {
  expect(res.headers.get("content-type")).toBe("application/pdf");
  expect(res.headers.get("cache-control")).toBe("no-store");
  const buf = Buffer.from(await res.arrayBuffer());
  expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(buf.length).toBeGreaterThan(500);
}

d("P4 HTTP authorization (PostgreSQL koperasi_test_db)", () => {
  let prisma: PrismaClient;
  let fx: FixtureTracker;

  beforeAll(() => {
    prisma = getTestPrisma();
    fx = new FixtureTracker(prisma);
  });

  afterEach(async () => {
    as(null);
    await fx.cleanup();
  });

  // dunia uji: 2 anggota (A, B) dengan akun, 1 kasir, 1 admin, 1 produk
  let w: Awaited<ReturnType<typeof world>>;
  async function world() {
    const kasir = await fx.createUser({ role: "KASIR" });
    const admin = await fx.createUser({ role: "ADMIN" });
    const memberA = await fx.createMember();
    const memberB = await fx.createMember();
    const userA = await fx.createUser({ role: "ANGGOTA", memberId: memberA.id });
    const userB = await fx.createUser({ role: "ANGGOTA", memberId: memberB.id });
    const product = await fx.createProduct({ stock: 20, costPrice: 6000, sellPrice: 10000 });
    return { kasir, admin, memberA, memberB, userA, userB, product };
  }
  beforeEach(async () => {
    w = await world();
  });

  const asKasir = () => as(sess(w.kasir.id, "KASIR"));
  const asAdmin = () => as(sess(w.admin.id, "ADMIN"));
  const asA = () => as(sess(w.userA.id, "ANGGOTA", w.memberA.id));
  const asB = () => as(sess(w.userB.id, "ANGGOTA", w.memberB.id));

  async function orderOf(memberId: string, qty = 2) {
    const o = await createOrder({
      memberId,
      items: [{ productId: w.product.id, qty }],
      createdBy: w.kasir.id,
    });
    fx.trackOrder(o.id);
    return o;
  }
  async function readyOrder(memberId: string, qty = 2) {
    const o = await orderOf(memberId, qty);
    await confirmOrder(o.id, { userId: w.kasir.id });
    await advanceOrder(o.id, "DISIAPKAN", { userId: w.kasir.id });
    await advanceOrder(o.id, "SIAP_DIAMBIL", { userId: w.kasir.id });
    return o;
  }
  const statusOf = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

  // ===================================================================
  // GET /api/orders/[id]/proof
  // ===================================================================
  describe("GET /api/orders/[id]/proof", () => {
    it("401 without session", async () => {
      const o = await orderOf(w.memberA.id);
      as(null);
      const res = await getProof(jsonReq(`/api/orders/${o.id}/proof`, "GET"), ctx(o.id));
      expect(res.status).toBe(401);
    });

    it("200 PDF for the owning member", async () => {
      const o = await orderOf(w.memberA.id);
      asA();
      const res = await getProof(jsonReq(`/api/orders/${o.id}/proof`, "GET"), ctx(o.id));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toContain(`bukti-${o.orderNo}.pdf`);
      await isPdf(res);
    });

    it("404 for ANOTHER member, indistinguishable from a missing order (no enumeration/leak)", async () => {
      const o = await orderOf(w.memberA.id);
      asB();
      const cross = await getProof(jsonReq(`/api/orders/${o.id}/proof`, "GET"), ctx(o.id));
      const missing = await getProof(jsonReq("/api/orders/does-not-exist/proof", "GET"), ctx("does-not-exist"));
      expect(cross.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(await cross.json()).toEqual(await missing.json());
      expect(cross.headers.get("content-type")).not.toBe("application/pdf");
    });

    it("403 for a session without a member (staff use the admin screens, not the member proof)", async () => {
      const o = await orderOf(w.memberA.id);
      asKasir();
      const res = await getProof(jsonReq(`/api/orders/${o.id}/proof`, "GET"), ctx(o.id));
      expect(res.status).toBe(403);
    });
  });

  // ===================================================================
  // GET /api/sales/[id]/pdf
  // ===================================================================
  describe("GET /api/sales/[id]/pdf", () => {
    async function sales() {
      const o = await readyOrder(w.memberA.id, 2);
      await completeOrder(o.id, { userId: w.kasir.id });
      const orderSale = (await fx.salesOfOrder(o.id))[0];
      const posMemberA = await createSale({
        items: [{ productId: w.product.id, qty: 1 }],
        memberId: w.memberA.id,
        createdBy: w.kasir.id,
      });
      const posAnon = await createSale({ items: [{ productId: w.product.id, qty: 1 }], createdBy: w.kasir.id });
      fx.trackSale(posMemberA.id);
      fx.trackSale(posAnon.id);
      return { orderSale, posMemberA, posAnon };
    }
    const get = (id: string) => getSalePdf(jsonReq(`/api/sales/${id}/pdf`, "GET"), ctx(id));

    it("401 without session", async () => {
      const s = await sales();
      as(null);
      expect((await get(s.orderSale.id)).status).toBe(401);
    });

    it("member A: 200 for the sale produced by A's order and for A's own POS sale", async () => {
      const s = await sales();
      asA();
      const r1 = await get(s.orderSale.id);
      expect(r1.status).toBe(200);
      await isPdf(r1);
      expect((await get(s.posMemberA.id)).status).toBe(200);
    });

    it("member A: 403 for an anonymous POS sale; member B: 403 for A's sales", async () => {
      const s = await sales();
      asA();
      expect((await get(s.posAnon.id)).status).toBe(403);
      asB();
      expect((await get(s.orderSale.id)).status).toBe(403);
      expect((await get(s.posMemberA.id)).status).toBe(403);
    });

    it("ANGGOTA role without a linked member: 403", async () => {
      const s = await sales();
      as(sess(w.userA.id, "ANGGOTA", null));
      expect((await get(s.orderSale.id)).status).toBe(403);
    });

    it("KASIR and ADMIN may open any receipt", async () => {
      const s = await sales();
      asKasir();
      expect((await get(s.orderSale.id)).status).toBe(200);
      expect((await get(s.posAnon.id)).status).toBe(200);
      asAdmin();
      const res = await get(s.posMemberA.id);
      expect(res.status).toBe(200);
      await isPdf(res);
    });

    it("404 for an unknown sale id (authenticated)", async () => {
      asKasir();
      expect((await get("does-not-exist")).status).toBe(404);
    });
  });

  // ===================================================================
  // PATCH /api/orders/[id]
  // ===================================================================
  describe("PATCH /api/orders/[id]", () => {
    const patch = (id: string, body: unknown) => patchOrder(jsonReq(`/api/orders/${id}`, "PATCH", body), ctx(id));

    it("401 without session", async () => {
      const o = await orderOf(w.memberA.id);
      as(null);
      expect((await patch(o.id, { action: "confirm" })).status).toBe(401);
      expect(await statusOf(o.id)).toBe("DIAJUKAN");
    });

    it("403 for ANGGOTA, and the order + stock are untouched", async () => {
      const o = await orderOf(w.memberA.id);
      asA();
      expect((await patch(o.id, { action: "confirm" })).status).toBe(403);
      expect((await patch(o.id, { action: "complete" })).status).toBe(403);
      expect(await statusOf(o.id)).toBe("DIAJUKAN");
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
    });

    it("401 when a staff session carries no user id (no silent fallback actor)", async () => {
      const o = await orderOf(w.memberA.id);
      as(sess(undefined, "KASIR"));
      expect((await patch(o.id, { action: "confirm" })).status).toBe(401);
      expect(await statusOf(o.id)).toBe("DIAJUKAN");
    });

    it("KASIR runs the whole lifecycle over HTTP with the right DB effects", async () => {
      const o = await orderOf(w.memberA.id, 3);
      asKasir();
      expect((await patch(o.id, { action: "confirm" })).status).toBe(200);
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 3 });
      expect((await patch(o.id, { action: "prepare" })).status).toBe(200);
      expect((await patch(o.id, { action: "ready" })).status).toBe(200);
      expect(
        (await patch(o.id, { action: "complete", paymentMethod: "TRANSFER", paymentStatus: "LUNAS" })).status
      ).toBe(200);

      expect(await statusOf(o.id)).toBe("SELESAI");
      expect(await fx.stock(w.product.id)).toEqual({ stock: 17, reservedStock: 0 });
      const [sale] = await fx.salesOfOrder(o.id);
      expect(sale).toMatchObject({
        paymentMethod: "TRANSFER",
        paymentStatus: "LUNAS",
        createdBy: w.kasir.id,
        memberId: w.memberA.id,
      });
      const actions = (await fx.audits("Order", o.id)).map((a) => a.action);
      expect(actions).toEqual(["CREATE_ORDER", "CONFIRM_ORDER", "ADVANCE_ORDER", "ADVANCE_ORDER", "COMPLETE_ORDER"]);
    });

    it("ADMIN may also process orders", async () => {
      const o = await orderOf(w.memberB.id);
      asAdmin();
      expect((await patch(o.id, { action: "confirm" })).status).toBe(200);
      expect(await statusOf(o.id)).toBe("DIKONFIRMASI");
      const confirmAudit = (await fx.audits("Order", o.id)).find((a) => a.action === "CONFIRM_ORDER");
      expect(confirmAudit?.userId).toBe(w.admin.id);
    });

    it("400 for unknown action, illegal transition, bad payment enum and missing reject reason; state unchanged", async () => {
      const o = await orderOf(w.memberA.id);
      asKasir();
      expect((await patch(o.id, { action: "explode" })).status).toBe(400);
      expect((await patch(o.id, { action: "prepare" })).status).toBe(400); // DIAJUKAN -> DISIAPKAN illegal
      expect((await patch(o.id, { action: "reject", reason: "  " })).status).toBe(400);
      expect(await statusOf(o.id)).toBe("DIAJUKAN");

      const ready = await readyOrder(w.memberB.id);
      const bad = await patch(ready.id, { action: "complete", paymentMethod: "BITCOIN" });
      expect(bad.status).toBe(400);
      const badStatus = await patch(ready.id, { action: "complete", paymentStatus: "MAYBE" });
      expect(badStatus.status).toBe(400);
      expect(await statusOf(ready.id)).toBe("SIAP_DIAMBIL");
      expect(await fx.salesOfOrder(ready.id)).toHaveLength(0);
    });

    it("malformed JSON body -> 400", async () => {
      const o = await orderOf(w.memberA.id);
      asKasir();
      const res = await patchOrder(
        new Request(`http://localhost/api/orders/${o.id}`, { method: "PATCH", body: "{not json" }),
        ctx(o.id)
      );
      expect(res.status).toBe(400);
    });

    it("404 for an unknown order id", async () => {
      asKasir();
      expect((await patch("does-not-exist", { action: "confirm" })).status).toBe(404);
    });

    it("reject releases the reservation and records the reason", async () => {
      const o = await orderOf(w.memberA.id, 4);
      asKasir();
      await patch(o.id, { action: "confirm" });
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 4 });
      expect((await patch(o.id, { action: "reject", reason: "Stok rusak" })).status).toBe(200);
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(row).toMatchObject({ status: "DITOLAK", rejectReason: "Stok rusak" });
    });
  });

  // ===================================================================
  // POST /api/orders/[id]/cancel
  // ===================================================================
  describe("POST /api/orders/[id]/cancel", () => {
    const cancel = (id: string) => cancelOrderRoute(jsonReq(`/api/orders/${id}/cancel`, "POST"), ctx(id));

    it("401 without session; 403 for sessions without a member", async () => {
      const o = await orderOf(w.memberA.id);
      as(null);
      expect((await cancel(o.id)).status).toBe(401);
      asKasir();
      expect((await cancel(o.id)).status).toBe(403);
      expect(await statusOf(o.id)).toBe("DIAJUKAN");
    });

    it("404 for another member's order, and it stays untouched", async () => {
      const o = await orderOf(w.memberA.id);
      asB();
      expect((await cancel(o.id)).status).toBe(404);
      expect(await statusOf(o.id)).toBe("DIAJUKAN");
      expect(await fx.audits("Order", o.id).then((a) => a.map((x) => x.action))).toEqual(["CREATE_ORDER"]);
    });

    it("the owner can cancel while DIAJUKAN; audit records the member's user id", async () => {
      const o = await orderOf(w.memberA.id, 3);
      asA();
      expect((await cancel(o.id)).status).toBe(200);
      expect(await statusOf(o.id)).toBe("DIBATALKAN");
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
      const audit = (await fx.audits("Order", o.id)).find((a) => a.action === "CANCEL_ORDER");
      expect(audit?.userId).toBe(w.userA.id);
    });

    it("400 once the order was confirmed or prepared; the reservation remains", async () => {
      const o = await orderOf(w.memberA.id, 2);
      await confirmOrder(o.id, { userId: w.kasir.id });
      asA();
      expect((await cancel(o.id)).status).toBe(400);
      expect(await statusOf(o.id)).toBe("DIKONFIRMASI");

      await advanceOrder(o.id, "DISIAPKAN", { userId: w.kasir.id });
      expect((await cancel(o.id)).status).toBe(400);
      expect(await statusOf(o.id)).toBe("DISIAPKAN");
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 2 });
    });

    it("staff cancelling a confirmed order through PATCH releases the reservation", async () => {
      const o = await orderOf(w.memberA.id, 3);
      await confirmOrder(o.id, { userId: w.kasir.id });
      expect(await fx.stock(w.product.id)).toMatchObject({ reservedStock: 3 });
      asKasir();
      const res = await patchOrder(jsonReq(`/api/orders/${o.id}`, "PATCH", { action: "cancel" }), ctx(o.id));
      expect(res.status).toBe(200);
      expect(await statusOf(o.id)).toBe("DIBATALKAN");
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
      expect((await fx.reservations(o.id)).map((r) => r.status)).toEqual(["RELEASED"]);
    });
  });

  // ===================================================================
  // POST /api/orders
  // ===================================================================
  describe("POST /api/orders", () => {
    const post = (body: unknown) => postOrder(jsonReq("/api/orders", "POST", body));
    const created = async (res: Response) => {
      const body = (await res.json()) as { orderNo: string; total: number };
      const row = await prisma.order.findUniqueOrThrow({ where: { orderNo: body.orderNo } });
      fx.trackOrder(row.id);
      return { body, row };
    };

    it("401 without session", async () => {
      as(null);
      expect((await post({ items: [] })).status).toBe(401);
    });

    it("member orders only for themselves: body.memberId is ignored; price tampering is ignored", async () => {
      asA();
      const res = await post({
        memberId: w.memberB.id, // attempt to order on behalf of B
        items: [{ productId: w.product.id, qty: 2, unitPrice: 1, price: 1 }], // attempt to set price
      });
      expect(res.status).toBe(201);
      const { body, row } = await created(res);
      expect(row.memberId).toBe(w.memberA.id);
      expect(row.createdBy).toBe(w.userA.id);
      expect(body.total).toBe(2 * 10000);
      expect(row.total).toBe(2 * 10000);
    });

    it("403 for an ANGGOTA session with no linked member", async () => {
      as(sess(w.userA.id, "ANGGOTA", null));
      expect((await post({ items: [{ productId: w.product.id, qty: 1 }] })).status).toBe(403);
    });

    it("staff must name the member (400), then the order is created on that member's behalf", async () => {
      asKasir();
      expect((await post({ items: [{ productId: w.product.id, qty: 1 }] })).status).toBe(400);
      const res = await post({ memberId: w.memberB.id, items: [{ productId: w.product.id, qty: 1 }] });
      expect(res.status).toBe(201);
      const { row } = await created(res);
      expect(row.memberId).toBe(w.memberB.id);
      expect(row.createdBy).toBe(w.kasir.id);
    });

    it("400 for malformed cart, bad quantities and inactive/insufficient products; nothing is created", async () => {
      asA();
      const before = await prisma.order.count({ where: { memberId: w.memberA.id } });
      expect((await post({ items: "nope" })).status).toBe(400);
      expect((await post({ items: [] })).status).toBe(400);
      expect((await post({ items: [{ productId: w.product.id, qty: 0 }] })).status).toBe(400);
      expect((await post({ items: [{ productId: w.product.id, qty: 1.5 }] })).status).toBe(400);
      expect((await post({ items: [{ productId: w.product.id, qty: 999 }] })).status).toBe(400);
      expect((await post({ items: [{ productId: "does-not-exist", qty: 1 }] })).status).toBe(400);
      expect(await prisma.order.count({ where: { memberId: w.memberA.id } })).toBe(before);
    });
  });

  // ===================================================================
  // POST /api/sales
  // ===================================================================
  describe("POST /api/sales", () => {
    const post = (body: unknown) => postSale(jsonReq("/api/sales", "POST", body));
    const item = (qty = 1) => ({ productId: w.product.id, qty });

    it("401 without session; 403 for ANGGOTA; no stock change", async () => {
      as(null);
      expect((await post({ items: [item()] })).status).toBe(401);
      asA();
      expect((await post({ items: [item()] })).status).toBe(403);
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
    });

    it("401 when a staff session has no user id", async () => {
      as(sess(undefined, "KASIR"));
      expect((await post({ items: [item()] })).status).toBe(401);
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
    });

    it("KASIR and ADMIN can sell; actor is recorded from the session, not from the body", async () => {
      asKasir();
      const r1 = await post({ items: [item(2)], createdBy: w.admin.id, paymentMethod: "LAINNYA" });
      expect(r1.status).toBe(201);
      const s1 = (await r1.json()) as { id: string; saleNo: string };
      fx.trackSale(s1.id);
      const row1 = await prisma.sale.findUniqueOrThrow({ where: { id: s1.id } });
      expect(row1).toMatchObject({ createdBy: w.kasir.id, paymentMethod: "LAINNYA", paymentStatus: "LUNAS" });

      asAdmin();
      const r2 = await post({ items: [item(1)], paymentMethod: "TUNAI" });
      expect(r2.status).toBe(201);
      const s2 = (await r2.json()) as { id: string };
      fx.trackSale(s2.id);
      expect((await prisma.sale.findUniqueOrThrow({ where: { id: s2.id } })).createdBy).toBe(w.admin.id);

      expect(await fx.stock(w.product.id)).toEqual({ stock: 17, reservedStock: 0 });
    });

    it("400 for invalid payment enums, empty cart, over-stock; no side effects", async () => {
      asKasir();
      expect((await post({ items: [item()], paymentMethod: "BITCOIN" })).status).toBe(400);
      expect((await post({ items: [item()], paymentStatus: "MAYBE" })).status).toBe(400);
      expect((await post({ items: [] })).status).toBe(400);
      expect((await post({ items: [item(21)] })).status).toBe(400);
      expect((await post({ items: [item()], paymentMethod: "BON" })).status).toBe(400); // BON without member
      expect(await fx.stock(w.product.id)).toEqual({ stock: 20, reservedStock: 0 });
      expect(await fx.salesCreatedBy(w.kasir.id)).toHaveLength(0);
    });

    it("malformed JSON -> 400", async () => {
      asKasir();
      const res = await postSale(new Request("http://localhost/api/sales", { method: "POST", body: "{oops" }));
      expect(res.status).toBe(400);
    });
  });

  // ===================================================================
  // GET /api/orders/pending-count  (FR-5.5 badge feed)
  // ===================================================================
  describe("GET /api/orders/pending-count", () => {
    it("401 without session; 403 for ANGGOTA", async () => {
      as(null);
      expect((await getPendingCount()).status).toBe(401);
      asA();
      expect((await getPendingCount()).status).toBe(403);
    });

    it("staff see the live DIAJUKAN count: +1 on create, back after confirm", async () => {
      asKasir();
      const read = async () => ((await (await getPendingCount()).json()) as { count: number }).count;
      const base = await read();
      expect(base).toBe(await prisma.order.count({ where: { status: "DIAJUKAN" } }));

      const o = await orderOf(w.memberA.id);
      expect(await read()).toBe(base + 1);

      await confirmOrder(o.id, { userId: w.kasir.id });
      expect(await read()).toBe(base);

      asAdmin();
      expect(await read()).toBe(base);
    });
  });
});
