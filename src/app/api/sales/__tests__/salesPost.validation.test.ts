/**
 * Regresi POST /api/sales: baris keranjang yang cacat (mis. `null`) harus 400, bukan 500.
 * saleService di-mock, TIDAK ada akses database. Aturan auth/role/BON/diskon/enum pembayaran
 * dipastikan tidak berubah. Pasangan dengan service ASLI (tanpa DB) ada di salesPost.realService.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class SaleError extends Error {}
  return {
    session: null as unknown,
    SaleError,
    createSale: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => h.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/services/saleService", () => ({ SaleError: h.SaleError, createSale: h.createSale }));

import { POST } from "@/app/api/sales/route";

const kasir = { user: { id: "k1", role: "KASIR", memberId: null } };
const admin = { user: { id: "a1", role: "ADMIN", memberId: null } };
const member = { user: { id: "u-A", role: "ANGGOTA", memberId: "m-A" } };

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  h.session = kasir;
  vi.clearAllMocks();
  h.createSale.mockResolvedValue({ id: "s1", saleNo: "SLS-20260101-0001" });
});

describe("POST /api/sales — validasi baris keranjang", () => {
  const malformedItems: [string, unknown][] = [
    ["null di antara baris valid", [{ productId: "p1", qty: 1 }, null]],
    ["hanya null", [null]],
    ["angka", [5]],
    ["string", ["p1"]],
    ["boolean", [false]],
    ["array bersarang", [["p1", 1]]],
    ["tanpa productId", [{ qty: 1 }]],
    ["productId null", [{ productId: null, qty: 1 }]],
    ["productId angka", [{ productId: 123, qty: 1 }]],
    ["productId objek", [{ productId: { $ne: "x" }, qty: 1 }]],
    ["productId kosong/spasi", [{ productId: "  ", qty: 1 }]],
  ];

  it.each(malformedItems)("400 untuk %s, service tidak dipanggil, tidak ada 500", async (_label, items) => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ items });
    expect(res.status).toBe(400);
    expect(h.createSale).not.toHaveBeenCalled(); // tidak ada penulisan database
    expect(errSpy).not.toHaveBeenCalled(); // bukan jalur "kesalahan server"
    errSpy.mockRestore();
  });

  it("pesan error generik: tidak membocorkan detail internal", async () => {
    const res = await post({ items: [null] });
    const text = JSON.stringify(await res.json());
    expect(text).toBe(JSON.stringify({ error: "Data keranjang tidak valid." }));
    expect(text).not.toMatch(/TypeError|Cannot read|stack/i);
  });

  it("ADMIN juga mendapat 400 untuk baris cacat", async () => {
    h.session = admin;
    expect((await post({ items: [null] })).status).toBe(400);
    expect(h.createSale).not.toHaveBeenCalled();
  });

  it("baris cacat + payment enum tidak valid tetap 400 dan tidak menyentuh service", async () => {
    expect((await post({ items: [null], paymentMethod: "BITCOIN" })).status).toBe(400);
    expect(h.createSale).not.toHaveBeenCalled();
  });
});

describe("POST /api/sales — perilaku lama terjaga", () => {
  const items = [{ productId: "p1", qty: 2 }];

  it("tanpa sesi 401, ANGGOTA 403, staf tanpa user id 401 — sebelum validasi apa pun", async () => {
    h.session = null;
    expect((await post({ items: [null] })).status).toBe(401);
    h.session = member;
    expect((await post({ items: [null] })).status).toBe(403);
    h.session = { user: { id: undefined, role: "KASIR", memberId: null } };
    expect((await post({ items: [null] })).status).toBe(401);
    expect(h.createSale).not.toHaveBeenCalled();
  });

  it("JSON rusak tetap 400", async () => {
    const res = await POST(new Request("http://localhost/api/sales", { method: "POST", body: "{oops" }));
    expect(res.status).toBe(400);
    expect(h.createSale).not.toHaveBeenCalled();
  });

  it("items hilang / bukan array diperlakukan sebagai keranjang kosong: service dipanggil dengan [] dan SaleError -> 400", async () => {
    h.createSale.mockRejectedValue(new h.SaleError("Keranjang kasir masih kosong."));
    expect((await post({})).status).toBe(400);
    expect((await post({ items: "nope" })).status).toBe(400);
    expect(h.createSale).toHaveBeenCalledTimes(2);
    expect(h.createSale).toHaveBeenNthCalledWith(1, expect.objectContaining({ items: [] }));
    expect(h.createSale).toHaveBeenNthCalledWith(2, expect.objectContaining({ items: [] }));
  });

  it("items kosong [] tetap diteruskan ke service (aturan keranjang kosong di service)", async () => {
    h.createSale.mockRejectedValue(new h.SaleError("Keranjang kasir masih kosong."));
    expect((await post({ items: [] })).status).toBe(400);
    expect(h.createSale).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
  });

  it("permintaan valid: 201, aktor dari sesi, createdBy di body diabaikan, field tambahan baris diteruskan apa adanya", async () => {
    const res = await post({
      items: [{ productId: "p1", qty: 2, name: "Kopi", price: 1 }],
      memberId: "m-9",
      discount: 500,
      paymentMethod: "TRANSFER",
      createdBy: "someone-else",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "s1", saleNo: "SLS-20260101-0001" });
    expect(h.createSale).toHaveBeenCalledTimes(1);
    expect(h.createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ productId: "p1", qty: 2, name: "Kopi", price: 1 }],
        memberId: "m-9",
        discount: 500,
        paymentMethod: "TRANSFER",
        createdBy: "k1",
      })
    );
  });

  it("anggota anonim: memberId kosong -> null; diskon default 0", async () => {
    await post({ items });
    expect(h.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: null, discount: 0, createdBy: "k1" })
    );
  });

  it("enum pembayaran tidak valid tetap 400 tanpa memanggil service", async () => {
    expect((await post({ items, paymentMethod: "BITCOIN" })).status).toBe(400);
    expect((await post({ items, paymentStatus: "MAYBE" })).status).toBe(400);
    expect(h.createSale).not.toHaveBeenCalled();
  });

  it("aturan BON/stok/qty (SaleError dari service) tetap 400 dengan pesan service", async () => {
    h.createSale.mockRejectedValueOnce(new h.SaleError("Pembayaran BON hanya untuk anggota. Pilih anggota dulu."));
    const res = await post({ items, paymentMethod: "BON" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Pembayaran BON hanya untuk anggota. Pilih anggota dulu." });
  });

  it("galat tak terduga di service -> 500 generik tanpa detail internal", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.createSale.mockRejectedValueOnce(new Error("connection to postgres://u:secret@db failed"));
    const res = await post({ items });
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("secret");
    errSpy.mockRestore();
  });
});
