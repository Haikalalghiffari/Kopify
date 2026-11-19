import { StockMovementType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { suggestColumnMapping } from "@/lib/import/columnMapping";
import type { ParseImportFileResult } from "@/lib/import/types";
import { parseImportFile } from "@/lib/import/parseSpreadsheet";

const adjustStock = vi.fn();

vi.mock("../stockGateway", () => ({
  resolveStockService: vi.fn(async () => ({
    adjustStock,
  })),
}));

const mockTx = {
  category: { findMany: vi.fn() },
  unit: { findMany: vi.fn() },
  product: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
    category: { findMany: vi.fn() },
    unit: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/import/parseSpreadsheet", () => ({
  parseImportFile: vi.fn(),
}));

import { db } from "@/lib/db";
import { importProductsFromFile } from "../productImporter";

const masterCategories = [
  {
    id: "cat-1",
    name: "Sembako",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];
const masterUnits = [
  {
    id: "unit-1",
    name: "Kg",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

function productParseFixture(
  sku: string,
  overrides?: Partial<Record<string, string>>
): ParseImportFileResult {
  const headers = [
    "SKU",
    "Nama Barang",
    "Kategori",
    "Satuan",
    "Harga Beli",
    "Harga Jual",
    "Stok Awal",
  ];
  const cells: Record<string, { raw: string; display: string }> = {
    SKU: { raw: sku, display: sku },
    "Nama Barang": { raw: overrides?.name ?? "Beras", display: overrides?.name ?? "Beras" },
    Kategori: { raw: overrides?.category ?? "Sembako", display: overrides?.category ?? "Sembako" },
    Satuan: { raw: overrides?.unit ?? "Kg", display: overrides?.unit ?? "Kg" },
    "Harga Beli": { raw: overrides?.cost ?? "10000", display: overrides?.cost ?? "10000" },
    "Harga Jual": { raw: overrides?.sell ?? "12000", display: overrides?.sell ?? "12000" },
    "Stok Awal": { raw: overrides?.stock ?? "5", display: overrides?.stock ?? "5" },
  };
  return {
    format: "xlsx",
    filename: "produk.xlsx",
    worksheets: [{ name: "Sheet1", rowCount: 1 }],
    selectedWorksheet: {
      name: "Sheet1",
      headers,
      totalDataRows: 1,
      rows: [{ sourceRowNumber: 2, cells }],
    },
  };
}

const baseInput = {
  userId: "user-1",
  importLogId: "log-1",
  filename: "produk.xlsx",
  buffer: Buffer.from("x"),
  worksheetName: "Sheet1",
  strict: false,
};

describe("importProductsFromFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.category.findMany).mockResolvedValue(masterCategories);
    vi.mocked(db.unit.findMany).mockResolvedValue(masterUnits);
    mockTx.category.findMany.mockResolvedValue(masterCategories);
    mockTx.unit.findMany.mockResolvedValue(masterUnits);
    mockTx.product.findMany.mockResolvedValue([]);
    mockTx.product.create.mockResolvedValue({ id: "prod-1" });
    mockTx.product.update.mockResolvedValue({ id: "prod-1" });
    adjustStock.mockResolvedValue({
      productId: "prod-1",
      qtyChange: 5,
      movementId: "mov-1",
    });
  });

  it("membuat produk baru dengan stok awal lewat adjustStock IMPORT", async () => {
    vi.mocked(parseImportFile).mockReturnValue(productParseFixture("BRG-NEW"));
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-NEW").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.successRows).toBe(1);
    expect(mockTx.product.create).toHaveBeenCalledTimes(1);
    expect(mockTx.product.create.mock.calls[0][0].data.stock).toBe(0);
    expect(adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-1",
        qtyChange: 5,
        type: StockMovementType.IMPORT,
        refType: "IMPORT",
        refId: "log-1",
      }),
      mockTx
    );
  });

  it("produk baru stok nol tidak memanggil adjustStock", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      productParseFixture("BRG-ZERO", { stock: "0" })
    );
    const headers = productParseFixture("BRG-ZERO").selectedWorksheet.headers;
    const mapping = suggestColumnMapping(headers, "PRODUCTS");

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.successRows).toBe(1);
    expect(adjustStock).not.toHaveBeenCalled();
  });

  it("mode SKIP tidak mengubah produk yang sudah ada", async () => {
    vi.mocked(parseImportFile).mockReturnValue(productParseFixture("BRG-OLD"));
    mockTx.product.findMany.mockResolvedValue([
      { id: "p-old", sku: "BRG-OLD", deletedAt: null },
    ]);
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-OLD").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.skippedRows).toBe(1);
    expect(mockTx.product.create).not.toHaveBeenCalled();
    expect(adjustStock).not.toHaveBeenCalled();
  });

  it("mode ERROR menandai SKU yang sudah ada", async () => {
    vi.mocked(parseImportFile).mockReturnValue(productParseFixture("BRG-DUP"));
    mockTx.product.findMany.mockResolvedValue([
      { id: "p-dup", sku: "BRG-DUP", deletedAt: null },
    ]);
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-DUP").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "ERROR",
    });

    expect(result.failedRows).toBe(1);
    expect(
      result.rowResults[0].errors.some((e) => e.message.includes("mode error"))
    ).toBe(true);
  });

  it("UPDATE menolak kolom stok awal terisi", async () => {
    vi.mocked(parseImportFile).mockReturnValue(productParseFixture("BRG-UPD"));
    mockTx.product.findMany.mockResolvedValue([
      { id: "p-upd", sku: "BRG-UPD", deletedAt: null },
    ]);
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-UPD").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "UPDATE",
    });

    expect(result.failedRows).toBe(1);
    expect(
      result.rowResults.find((r) => r.outcome === "failed")?.errors[0].field
    ).toBe("openingStock");
  });

  it("baris gagal jika adjustStock gagal (produk tidak konsisten)", async () => {
    vi.mocked(parseImportFile).mockReturnValue(productParseFixture("BRG-FAIL"));
    adjustStock.mockRejectedValue(new Error("stok gagal"));
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-FAIL").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.failedRows).toBe(1);
    expect(result.rowResults[0].outcome).toBe("failed");
    expect(mockTx.product.delete).toHaveBeenCalledWith({
      where: { id: "prod-1" },
    });
  });

  it("rollback batch jika transaksi melempar error", async () => {
    vi.mocked(parseImportFile).mockReturnValue(productParseFixture("BRG-TX"));
    vi.mocked(db.$transaction).mockRejectedValueOnce(new Error("tx fail"));
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-TX").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.failedRows).toBe(1);
    expect(
      result.rowResults.some((r) => r.errors.some((e) => e.field === "_batch"))
    ).toBe(true);
  });

  it("menolak kategori tidak ada di master", async () => {
    vi.mocked(parseImportFile).mockReturnValue(
      productParseFixture("BRG-CAT", { category: "TidakAda" })
    );
    const mapping = suggestColumnMapping(
      productParseFixture("BRG-CAT").selectedWorksheet.headers,
      "PRODUCTS"
    );

    const result = await importProductsFromFile({
      ...baseInput,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.failedRows).toBe(1);
    expect(mockTx.product.create).not.toHaveBeenCalled();
  });
});