import { describe, it, expect, vi, beforeEach } from "vitest";
import { StockMovementType } from "@prisma/client";
import { SaleError } from "../saleService";

const mocks = vi.hoisted(() => {
  const mockAdjustStock = vi.fn();

  const mockTx = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    member: { findFirst: vi.fn() },
    sale: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
  };

  return { mockTx, mockAdjustStock };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mocks.mockTx) => unknown) => fn(mocks.mockTx)),
  },
}));

vi.mock("@/services/stockService", () => ({
  stockService: {
    adjustStock: mocks.mockAdjustStock,
  },
}));

vi.mock("@/services/documentNumber", () => ({
  nextDocumentNumber: vi.fn().mockResolvedValue("SLS-20261118-0001"),
}));

vi.mock("@/services/p4Audit", () => ({
  auditSaleAction: vi.fn(),
}));

import { createSale } from "../saleService";

const productRow = {
  name: "Kopi",
  stock: 50,
  reserved_stock: 10,
  cost_price: 8000,
  sell_price: 12000,
  is_active: true,
  deleted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockTx.$executeRaw.mockResolvedValue(undefined);
  mocks.mockTx.$queryRaw.mockResolvedValue([productRow]);
  mocks.mockAdjustStock.mockResolvedValue({
    productId: "p1",
    qtyChange: -2,
    stockBefore: 50,
    stockAfter: 48,
    movementId: "mov-1",
  });
  mocks.mockTx.sale.create.mockImplementation(({ data }: { data: { saleNo: string } }) => ({
    id: "sale-1",
    saleNo: data.saleNo,
    saleItems: [],
  }));
});

describe("saleService POS stock integration (unit)", () => {
  it("calls adjustStock with negative qty and SALE type after sale record is created", async () => {
    await createSale({
      items: [{ productId: "p1", qty: 2 }],
      createdBy: "kasir-1",
    });

    expect(mocks.mockTx.sale.create).toHaveBeenCalled();
    expect(mocks.mockAdjustStock).toHaveBeenCalledWith(
      {
        productId: "p1",
        qtyChange: -2,
        type: StockMovementType.SALE,
        refType: "SALE",
        refId: "sale-1",
        note: expect.stringMatching(/^Penjualan SLS-/),
        userId: "kasir-1",
      },
      mocks.mockTx
    );
  });

  it("validates available stock = stock - reserved before creating sale", async () => {
    mocks.mockTx.$queryRaw.mockResolvedValue([
      { ...productRow, stock: 12, reserved_stock: 10 },
    ]);

    await expect(
      createSale({ items: [{ productId: "p1", qty: 5 }], createdBy: "kasir-1" })
    ).rejects.toThrow(/tidak cukup \(tersedia 2\)/);
    expect(mocks.mockTx.sale.create).not.toHaveBeenCalled();
    expect(mocks.mockAdjustStock).not.toHaveBeenCalled();
  });

  it("rolls back sale when adjustStock fails", async () => {
    mocks.mockAdjustStock.mockRejectedValueOnce(new Error("Stok tersedia tidak cukup"));

    await expect(
      createSale({ items: [{ productId: "p1", qty: 2 }], createdBy: "kasir-1" })
    ).rejects.toThrow(
      SaleError
    );
  });

  it("rejects BON without member", async () => {
    await expect(
      createSale({
        items: [{ productId: "p1", qty: 1 }],
        paymentMethod: "BON",
        createdBy: "kasir-1",
      })
    ).rejects.toThrow("Pembayaran BON hanya untuk anggota");
  });

  it("rejects missing actor id", async () => {
    await expect(createSale({ items: [{ productId: "p1", qty: 1 }] })).rejects.toThrow(
      /Sesi tidak valid/
    );
  });

  it("rejects discount greater than subtotal", async () => {
    await expect(
      createSale({
        items: [{ productId: "p1", qty: 1 }],
        discount: 50000,
        createdBy: "kasir-1",
      })
    ).rejects.toThrow("Diskon tidak boleh lebih besar dari total belanja.");
  });
});