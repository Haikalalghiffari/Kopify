/**
 * Reproduksi & bukti "tidak ada penulisan DB" untuk POST /api/sales memakai saleService ASLI.
 * Database, stockService, penomoran dan audit di-mock; semua spy harus tetap kosong untuk input cacat.
 * Tanpa koneksi database. Sebelum perbaikan route, baris `null` melempar TypeError di service (-> 500).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: { user: { id: "k1", role: "KASIR", memberId: null } } as unknown,
  transaction: vi.fn(),
  memberFindFirst: vi.fn(),
  adjustStock: vi.fn(),
  nextDocumentNumber: vi.fn(),
  auditSaleAction: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => h.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: { $transaction: h.transaction, member: { findFirst: h.memberFindFirst } },
}));
vi.mock("@/services/stockService", () => ({ stockService: { adjustStock: h.adjustStock } }));
vi.mock("@/services/documentNumber", () => ({ nextDocumentNumber: h.nextDocumentNumber }));
vi.mock("@/services/p4Audit", () => ({ auditSaleAction: h.auditSaleAction }));

import { POST } from "@/app/api/sales/route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const expectNoDbWrite = () => {
  expect(h.transaction).not.toHaveBeenCalled();
  expect(h.memberFindFirst).not.toHaveBeenCalled();
  expect(h.adjustStock).not.toHaveBeenCalled();
  expect(h.nextDocumentNumber).not.toHaveBeenCalled();
  expect(h.auditSaleAction).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/sales + saleService asli: input cacat tidak menyentuh database", () => {
  it.each([
    ["null di antara baris valid", [{ productId: "p1", qty: 1 }, null]],
    ["hanya null", [null]],
    ["productId angka", [{ productId: 123, qty: 1 }]],
    ["productId objek", [{ productId: { not: "x" }, qty: 1 }]],
    ["tanpa productId", [{ qty: 1 }]],
  ])("400 untuk %s tanpa transaksi, stok, nomor, atau audit", async (_label, items) => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ items });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Data keranjang tidak valid." });
    expectNoDbWrite();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("aturan service tetap berlaku untuk bentuk valid: qty 0, 1.5, negatif, string -> 400 dari service, tanpa DB", async () => {
    for (const qty of [0, 1.5, -2, "2"]) {
      const res = await post({ items: [{ productId: "p1", qty }] });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Jumlah barang harus bilangan bulat lebih dari 0.");
    }
    expectNoDbWrite();
  });

  it("keranjang kosong / items hilang -> 400 'Keranjang kasir masih kosong.' tanpa DB", async () => {
    for (const body of [{ items: [] }, {}, { items: "nope" }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Keranjang kasir masih kosong.");
    }
    expectNoDbWrite();
  });

  it("BON tanpa anggota -> 400 dari service tanpa DB; diskon tidak valid -> 400 tanpa DB", async () => {
    const bon = await post({ items: [{ productId: "p1", qty: 1 }], paymentMethod: "BON" });
    expect(bon.status).toBe(400);
    expect((await bon.json()).error).toBe("Pembayaran BON hanya untuk anggota. Pilih anggota dulu.");
    const disc = await post({ items: [{ productId: "p1", qty: 1 }], discount: -1 });
    expect(disc.status).toBe(400);
    expectNoDbWrite();
  });

  it("kontrol: bentuk valid MEMANG masuk ke transaksi (membuktikan spy-nya hidup)", async () => {
    h.transaction.mockRejectedValueOnce(new Error("stop here"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ items: [{ productId: "p1", qty: 1 }] });
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("stop here");
    errSpy.mockRestore();
  });
});
