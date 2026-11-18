import { ImportStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auditCreate = vi.fn();
const importLogCreate = vi.fn();
const importLogUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    importLog: {
      create: (...args: unknown[]) => importLogCreate(...args),
      update: (...args: unknown[]) => importLogUpdate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => auditCreate(...args),
    },
  },
}));

vi.mock("../productImporter", () => ({
  importProductsFromFile: vi.fn(async () => ({
    totalRows: 1,
    validationFailedCount: 0,
    successRows: 1,
    failedRows: 0,
    skippedRows: 0,
    rowResults: [],
  })),
}));

vi.mock("../stockGateway", () => ({
  isProductImportExecutionAllowed: vi.fn(async () => ({ allowed: true })),
}));

import { executeImport } from "../importService";

describe("executeImport audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importLogCreate.mockResolvedValue({ id: "log-pending" });
    importLogUpdate.mockResolvedValue({
      id: "log-final",
      status: ImportStatus.SUCCESS,
      totalRows: 1,
      successRows: 1,
      failedRows: 0,
    });
    auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("menunggu auditLog IMPORT_EXECUTE sebelum resolve (produk)", async () => {
    let auditStarted = false;
    let importFinished = false;
    auditCreate.mockImplementation(async () => {
      auditStarted = true;
      expect(importFinished).toBe(false);
      return { id: "audit-1" };
    });

    await executeImport({
      userId: "user-1",
      importType: "PRODUCTS",
      filename: "test.xlsx",
      buffer: Buffer.from("x"),
      mapping: {},
      duplicateMode: "SKIP",
    });
    importFinished = true;
    expect(auditStarted).toBe(true);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "IMPORT_EXECUTE",
          entity: "ImportLog",
          entityId: "log-final",
        }),
      })
    );
  });
});