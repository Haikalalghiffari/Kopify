/**
 * Uji unit route handler P4 TANPA database (semua dependensi di-mock).
 * Mengunci kontrak HTTP: 401/403/404/400 dan bahwa identitas diambil dari sesi, bukan dari body.
 * Pasangan "nyata" dengan PostgreSQL ada di src/tests/p4/authorization.http.integration.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class OrderError extends Error {}
  class OrderNotFoundError extends OrderError {
    constructor() {
      super("Pesanan tidak ditemukan.");
    }
  }
  class SaleError extends Error {}
  return {
    session: null as unknown,
    OrderError,
    OrderNotFoundError,
    SaleError,
    getMemberOrder: vi.fn(),
    cancelOrder: vi.fn(),
    createSale: vi.fn(),
    memberFindUnique: vi.fn(),
    saleFindUnique: vi.fn(),
    orderCount: vi.fn(),
    buildOrderProofPdf: vi.fn(),
    buildSaleReceiptPdf: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => h.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    member: { findUnique: h.memberFindUnique },
    sale: { findUnique: h.saleFindUnique },
    order: { count: h.orderCount },
  },
}));
vi.mock("@/services/orderService", () => ({
  OrderError: h.OrderError,
  OrderNotFoundError: h.OrderNotFoundError,
  getMemberOrder: h.getMemberOrder,
  cancelOrder: h.cancelOrder,
}));
vi.mock("@/services/saleService", () => ({ SaleError: h.SaleError, createSale: h.createSale }));
vi.mock("@/lib/pdf/documents", () => ({
  buildOrderProofPdf: h.buildOrderProofPdf,
  buildSaleReceiptPdf: h.buildSaleReceiptPdf,
}));

import { GET as getProof } from "@/app/api/orders/[id]/proof/route";
import { POST as cancelRoute } from "@/app/api/orders/[id]/cancel/route";
import { GET as getSalePdf } from "@/app/api/sales/[id]/pdf/route";
import { POST as postSale } from "@/app/api/sales/route";
import { GET as getPendingCount } from "@/app/api/orders/pending-count/route";

type Role = "ADMIN" | "KASIR" | "ANGGOTA";
const sess = (id: string | undefined, role: Role, memberId: string | null = null) => ({
  user: { id, role, memberId },
});
const req = (method = "GET", body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id = "id-1") => ({ params: { id } });

const orderRow = (memberId: string) => ({
  id: "id-1",
  orderNo: "ORD-20260101-0001",
  memberId,
  status: "SELESAI",
  createdAt: new Date("2026-01-01T03:00:00Z"),
  note: null,
  rejectReason: null,
  total: 20000,
  orderItems: [{ qty: 2, unitPrice: 10000, product: { name: "Kopi", unit: { name: "pcs" } } }],
});

const saleRow = (over: Record<string, unknown> = {}) => ({
  id: "sale-1",
  saleNo: "SLS-20260101-0001",
  soldAt: new Date("2026-01-01T03:00:00Z"),
  total: 19000,
  discount: 1000,
  paymentMethod: "BON",
  paymentStatus: "BELUM_LUNAS",
  memberId: "m-A",
  member: { memberNo: "ANG-1", name: "Ani" },
  user: { username: "kasir1" },
  order: null,
  saleItems: [{ qty: 2, unitPrice: 10000, product: { name: "Kopi", unit: { name: "pcs" } } }],
  ...over,
});

beforeEach(() => {
  h.session = null;
  vi.clearAllMocks();
  h.buildOrderProofPdf.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  h.buildSaleReceiptPdf.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  h.memberFindUnique.mockResolvedValue({ memberNo: "ANG-1", name: "Ani" });
});

describe("GET /api/orders/[id]/proof", () => {
  it("401 without session", async () => {
    expect((await getProof(req(), ctx())).status).toBe(401);
    expect(h.getMemberOrder).not.toHaveBeenCalled();
  });

  it("403 for a session without a member", async () => {
    h.session = sess("k1", "KASIR");
    expect((await getProof(req(), ctx())).status).toBe(403);
    expect(h.getMemberOrder).not.toHaveBeenCalled();
  });

  it("404 when the service hides someone else's order", async () => {
    h.session = sess("u-B", "ANGGOTA", "m-B");
    h.getMemberOrder.mockRejectedValue(new h.OrderNotFoundError());
    expect((await getProof(req(), ctx())).status).toBe(404);
    expect(h.getMemberOrder).toHaveBeenCalledWith("id-1", "m-B");
    expect(h.buildOrderProofPdf).not.toHaveBeenCalled();
  });

  it("404 (defense in depth) even if the service ever returned a foreign order", async () => {
    h.session = sess("u-B", "ANGGOTA", "m-B");
    h.getMemberOrder.mockResolvedValue(orderRow("m-A"));
    expect((await getProof(req(), ctx())).status).toBe(404);
    expect(h.buildOrderProofPdf).not.toHaveBeenCalled();
  });

  it("200 PDF with no-store for the owner", async () => {
    h.session = sess("u-A", "ANGGOTA", "m-A");
    h.getMemberOrder.mockResolvedValue(orderRow("m-A"));
    const res = await getProof(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toContain("bukti-ORD-20260101-0001.pdf");
    expect(h.buildOrderProofPdf).toHaveBeenCalledWith(
      expect.objectContaining({ orderNo: "ORD-20260101-0001", total: 20000, subtotal: 20000 })
    );
  });
});

describe("GET /api/sales/[id]/pdf", () => {
  it("401 without session", async () => {
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(401);
    expect(h.saleFindUnique).not.toHaveBeenCalled();
  });

  it("404 when the sale does not exist", async () => {
    h.session = sess("k1", "KASIR");
    h.saleFindUnique.mockResolvedValue(null);
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(404);
  });

  it("403 for a member who is neither buyer nor order owner", async () => {
    h.session = sess("u-B", "ANGGOTA", "m-B");
    h.saleFindUnique.mockResolvedValue(saleRow());
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(403);
    expect(h.buildSaleReceiptPdf).not.toHaveBeenCalled();
  });

  it("403 for a member on an anonymous sale", async () => {
    h.session = sess("u-A", "ANGGOTA", "m-A");
    h.saleFindUnique.mockResolvedValue(saleRow({ memberId: null, member: null }));
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(403);
  });

  it("200 for the buyer, and the receipt carries payment method, status and discount", async () => {
    h.session = sess("u-A", "ANGGOTA", "m-A");
    h.saleFindUnique.mockResolvedValue(saleRow());
    const res = await getSalePdf(req(), ctx("sale-1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(h.buildSaleReceiptPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        saleNo: "SLS-20260101-0001",
        paymentMethod: "BON",
        paymentStatus: "BELUM_LUNAS",
        discount: 1000,
        total: 19000,
        subtotal: 20000,
      })
    );
  });

  it("200 for a member via the originating order, and for KASIR/ADMIN on any sale", async () => {
    h.saleFindUnique.mockResolvedValue(
      saleRow({ memberId: null, member: null, order: { orderNo: "ORD-1", memberId: "m-A" } })
    );
    h.session = sess("u-A", "ANGGOTA", "m-A");
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(200);
    h.session = sess("k1", "KASIR");
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(200);
    h.session = sess("a1", "ADMIN");
    expect((await getSalePdf(req(), ctx("sale-1"))).status).toBe(200);
  });
});

describe("POST /api/orders/[id]/cancel", () => {
  it("401 / 403", async () => {
    expect((await cancelRoute(req("POST"), ctx())).status).toBe(401);
    h.session = sess("k1", "KASIR");
    expect((await cancelRoute(req("POST"), ctx())).status).toBe(403);
    expect(h.cancelOrder).not.toHaveBeenCalled();
  });

  it("passes the member and user from the session to the service", async () => {
    h.session = sess("u-A", "ANGGOTA", "m-A");
    h.cancelOrder.mockResolvedValue({});
    expect((await cancelRoute(req("POST"), ctx("o-9"))).status).toBe(200);
    expect(h.cancelOrder).toHaveBeenCalledWith("o-9", { memberId: "m-A", userId: "u-A" });
  });

  it("404 for another member's / missing order, 400 for a business rule, 500 for unexpected errors", async () => {
    h.session = sess("u-A", "ANGGOTA", "m-A");
    h.cancelOrder.mockRejectedValueOnce(new h.OrderNotFoundError());
    expect((await cancelRoute(req("POST"), ctx())).status).toBe(404);
    h.cancelOrder.mockRejectedValueOnce(new h.OrderError("Pesanan hanya bisa dibatalkan saat masih berstatus DIAJUKAN."));
    expect((await cancelRoute(req("POST"), ctx())).status).toBe(400);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.cancelOrder.mockRejectedValueOnce(new Error("db down"));
    const res = await cancelRoute(req("POST"), ctx());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db down"); // no internal detail leaked
    spy.mockRestore();
  });
});

describe("POST /api/sales", () => {
  const body = { items: [{ productId: "p1", qty: 1 }] };

  it("401 without session, 403 for ANGGOTA, 401 when the staff session lacks an id", async () => {
    expect((await postSale(req("POST", body))).status).toBe(401);
    h.session = sess("u-A", "ANGGOTA", "m-A");
    expect((await postSale(req("POST", body))).status).toBe(403);
    h.session = sess(undefined, "KASIR");
    expect((await postSale(req("POST", body))).status).toBe(401);
    expect(h.createSale).not.toHaveBeenCalled();
  });

  it("uses the session user as actor and ignores a createdBy in the body", async () => {
    h.session = sess("k1", "KASIR");
    h.createSale.mockResolvedValue({ id: "s1", saleNo: "SLS-1" });
    const res = await postSale(req("POST", { ...body, createdBy: "someone-else", paymentMethod: "TRANSFER" }));
    expect(res.status).toBe(201);
    expect(h.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "k1", paymentMethod: "TRANSFER" })
    );
  });

  it("400 for invalid payment enums and SaleError; the service is not called for bad enums", async () => {
    h.session = sess("k1", "KASIR");
    expect((await postSale(req("POST", { ...body, paymentMethod: "BITCOIN" }))).status).toBe(400);
    expect((await postSale(req("POST", { ...body, paymentStatus: "MAYBE" }))).status).toBe(400);
    expect(h.createSale).not.toHaveBeenCalled();
    h.createSale.mockRejectedValue(new h.SaleError("Stok tidak cukup"));
    expect((await postSale(req("POST", body))).status).toBe(400);
  });

  it("400 for malformed JSON", async () => {
    h.session = sess("k1", "KASIR");
    const res = await postSale(new Request("http://localhost/x", { method: "POST", body: "{oops" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/orders/pending-count", () => {
  it("401 / 403 / 200 with count", async () => {
    expect((await getPendingCount()).status).toBe(401);
    h.session = sess("u-A", "ANGGOTA", "m-A");
    expect((await getPendingCount()).status).toBe(403);
    expect(h.orderCount).not.toHaveBeenCalled();

    h.session = sess("k1", "KASIR");
    h.orderCount.mockResolvedValue(4);
    const res = await getPendingCount();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 4 });
    expect(h.orderCount).toHaveBeenCalledWith({ where: { status: "DIAJUKAN" } });
  });
});
