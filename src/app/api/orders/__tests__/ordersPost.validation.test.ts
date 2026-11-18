/**
 * Regresi POST /api/orders: baris keranjang yang cacat (mis. `null`) harus 400, bukan 500.
 * Semua dependensi di-mock: TIDAK ada akses database. Pasangan "nyata" (PostgreSQL) untuk
 * kasus qty/stok ada di src/tests/p4/authorization.http.integration.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class OrderError extends Error {}
  return {
    session: null as unknown,
    OrderError,
    createOrder: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => h.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/services/orderService", () => ({
  OrderError: h.OrderError,
  createOrder: h.createOrder,
}));

import { POST } from "@/app/api/orders/route";

const member = { user: { id: "u-A", role: "ANGGOTA", memberId: "m-A" } };
const kasir = { user: { id: "k1", role: "KASIR", memberId: null } };

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  h.session = member;
  vi.clearAllMocks();
  h.createOrder.mockResolvedValue({ orderNo: "ORD-20260101-0001", total: 20000 });
});

describe("POST /api/orders — validasi baris keranjang", () => {
  const malformedItems: [string, unknown][] = [
    ["null di antara baris valid", [{ productId: "p1", qty: 1 }, null]],
    ["hanya null", [null]],
    ["angka", [5]],
    ["string", ["p1"]],
    ["boolean", [true]],
    ["array bersarang", [["p1", 1]]],
    ["tanpa productId", [{ qty: 1 }]],
    ["productId null", [{ productId: null, qty: 1 }]],
    ["productId angka", [{ productId: 123, qty: 1 }]],
    ["productId objek", [{ productId: { $ne: "x" }, qty: 1 }]],
    ["productId kosong/spasi", [{ productId: "   ", qty: 1 }]],
  ];

  it.each(malformedItems)("400 untuk %s, service tidak dipanggil, tidak ada 500", async (_label, items) => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ items });
    expect(res.status).toBe(400);
    expect(h.createOrder).not.toHaveBeenCalled(); // tidak ada penulisan database
    expect(errSpy).not.toHaveBeenCalled(); // bukan jalur "kesalahan server"
    errSpy.mockRestore();
  });

  it("pesan error generik: tidak membocorkan detail internal", async () => {
    const res = await post({ items: [null] });
    const text = JSON.stringify(await res.json());
    expect(text).toBe(JSON.stringify({ error: "Data keranjang tidak valid." }));
    expect(text).not.toMatch(/TypeError|Cannot read|stack/i);
  });

  it("kasir dengan baris cacat juga 400 (sebelum service dipanggil)", async () => {
    h.session = kasir;
    const res = await post({ memberId: "m-A", items: [null] });
    expect(res.status).toBe(400);
    expect(h.createOrder).not.toHaveBeenCalled();
  });

  it("items bukan array / hilang tetap 400 (perilaku lama terjaga)", async () => {
    expect((await post({ items: "nope" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(h.createOrder).not.toHaveBeenCalled();
  });

  it("permintaan valid tetap 201 dan hanya productId + qty yang diteruskan (harga/field lain diabaikan)", async () => {
    const res = await post({
      memberId: "m-OTHER", // diabaikan untuk anggota
      note: "  tanpa gula  ",
      items: [{ productId: "p1", qty: 2, unitPrice: 1, price: 1, total: 1 }],
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ orderNo: "ORD-20260101-0001", total: 20000 });
    expect(h.createOrder).toHaveBeenCalledTimes(1);
    expect(h.createOrder).toHaveBeenCalledWith({
      memberId: "m-A",
      items: [{ productId: "p1", qty: 2 }],
      note: "tanpa gula",
      createdBy: "u-A",
    });
  });

  it("aturan qty tetap di service: qty tak valid diteruskan apa adanya dan OrderError -> 400", async () => {
    h.createOrder.mockRejectedValueOnce(new h.OrderError("Jumlah barang harus bilangan bulat lebih dari 0."));
    const res = await post({ items: [{ productId: "p1", qty: 1.5 }] });
    expect(res.status).toBe(400);
    expect(h.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ items: [{ productId: "p1", qty: 1.5 }] })
    );
  });

  it("galat tak terduga di service -> 500 generik tanpa detail internal", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.createOrder.mockRejectedValueOnce(new Error("connection to postgres://u:secret@db failed"));
    const res = await post({ items: [{ productId: "p1", qty: 1 }] });
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("secret");
    errSpy.mockRestore();
  });

  it("tanpa sesi tetap 401 dan service tidak dipanggil", async () => {
    h.session = null;
    expect((await post({ items: [null] })).status).toBe(401);
    expect(h.createOrder).not.toHaveBeenCalled();
  });
});
