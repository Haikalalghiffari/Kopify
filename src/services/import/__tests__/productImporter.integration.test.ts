/**
 * Integration test P3: impor produk + stok awal ke PostgreSQL test DB SAJA (koperasi_test_db).
 *
 * Menulis ke database dan TIDAK membersihkan data QA. Hanya jalan jika:
 *   P3_PRODUCT_DB_INTEGRATION=1
 * dan TEST_DATABASE_URL (atau derivasi) menunjuk ke koperasi_test_db.
 *
 * Impor anggota (koperasi_db) tetap terpisah: P3_DB_INTEGRATION — jangan aktifkan bersamaan
 * jika Anda ingin menghindari dua suite tulis DB paralel.
 *
 *   $env:TEST_DATABASE_URL="postgresql://...@localhost:5433/koperasi_test_db?schema=public"
 *   $env:P3_PRODUCT_DB_INTEGRATION="1"
 *   npx vitest run src/services/import/__tests__/productImporter.integration.test.ts
 */
import { StockMovementType } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { suggestColumnMapping } from "@/lib/import/columnMapping";
import { PRODUCT_FIELDS } from "@/lib/import/fields";
import { buildXlsxBufferFromRows } from "@/lib/import/parseSpreadsheet";
import type { ColumnMapping } from "@/lib/import/types";
import { parseImportLogMetadata } from "@/lib/import/importLogMeta";
import { vi } from "vitest";

const { testDbUrl, ENABLED } = vi.hoisted(() => {
  const url =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL?.replace(/\/koperasi_db(\?|$)/, "/koperasi_test_db$1") ||
    "postgresql://koperasi_user:koperasi_pass@localhost:5433/koperasi_test_db?schema=public";

  const parsedUrl = new URL(url);
  const dbName = parsedUrl.pathname.replace(/^\//, "").split("?")[0].toLowerCase();

  if (dbName !== "koperasi_test_db") {
    throw new Error(
      `SAFETY: product integration hanya diizinkan pada koperasi_test_db, terdeteksi "${dbName}".`
    );
  }

  return {
    testDbUrl: url,
    ENABLED: process.env.P3_PRODUCT_DB_INTEGRATION === "1",
  };
});

vi.mock("@/lib/db", () => {
  const { PrismaClient: PC } = require("@prisma/client");
  const db = new PC({
    datasources: { db: { url: testDbUrl } },
  });
  return { db };
});

import { db } from "@/lib/db";
import { executeImport, getImportLogById } from "@/services/import/importService";

const EXPECTED_HOST = "localhost";
const EXPECTED_PORT = "5433";
const EXPECTED_DB = "koperasi_test_db";

const QA_CATEGORY = "QA-P3-Master-Sembako";
const QA_UNIT = "QA-P3-Master-Kg";
const SKU_ZERO = "QA-P3-PROD-ZERO";
const SKU_STK = "QA-P3-PROD-STK10";
const SKU_UPD = "QA-P3-PROD-UPD";
const ADMIN_USERNAME = "qa-p3-product-admin";

const TEST_TIMEOUT_MS = 45_000;

interface Preflight {
  adminId: string;
  categoryId: string;
  unitId: string;
}

let pre: Preflight | null = null;

function productRow(values: {
  sku: string;
  name: string;
  categoryName?: string;
  unitName?: string;
  costPrice?: string;
  sellPrice?: string;
  openingStock?: string;
}): string[] {
  const map: Record<string, string> = {
    sku: values.sku,
    name: values.name,
    categoryName: values.categoryName ?? QA_CATEGORY,
    unitName: values.unitName ?? QA_UNIT,
    costPrice: values.costPrice ?? "10000",
    sellPrice: values.sellPrice ?? "12000",
    openingStock: values.openingStock ?? "0",
  };
  return PRODUCT_FIELDS.map((f) => map[f.key] ?? "");
}

function productWorkbook(
  rows: Array<{
    sku: string;
    name: string;
    categoryName?: string;
    unitName?: string;
    openingStock?: string;
    costPrice?: string;
    sellPrice?: string;
  }>
): { buffer: Buffer; mapping: ColumnMapping; headers: string[] } {
  const headers = PRODUCT_FIELDS.map((f) => f.label);
  const data = rows.map((r) => productRow(r));
  const buffer = buildXlsxBufferFromRows("Barang", headers, data);
  return { buffer, headers, mapping: suggestColumnMapping(headers, "PRODUCTS") };
}

async function runPreflight(): Promise<Preflight> {
  const problems: string[] = [];

  if (process.env.NODE_ENV === "production") {
    problems.push("NODE_ENV=production tidak diizinkan.");
  }

  let envUrl: URL;
  try {
    envUrl = new URL(testDbUrl);
  } catch {
    problems.push("URL database test tidak valid.");
    throw new Error(problems.join("\n"));
  }

  if (envUrl.hostname !== EXPECTED_HOST) {
    problems.push(`Host "${envUrl.hostname}" bukan ${EXPECTED_HOST}.`);
  }
  if (envUrl.port !== EXPECTED_PORT) {
    problems.push(`Port "${envUrl.port}" bukan ${EXPECTED_PORT}.`);
  }

  const [{ name: serverDb }] = await db.$queryRaw<
    { name: string }[]
  >`SELECT current_database()::text AS name`;
  if (serverDb !== EXPECTED_DB) {
    problems.push(`current_database() = "${serverDb}", bukan ${EXPECTED_DB}.`);
  }

  const qaSkuCount = await db.product.count({
    where: { sku: { startsWith: "QA-P3-PROD-" } },
  });
  if (qaSkuCount > 0) {
    problems.push(
      `${qaSkuCount} SKU QA-P3-PROD-* sudah ada di test DB. Bersihkan manual atau gunakan DB test baru sebelum suite.`
    );
  }

  if (problems.length > 0) {
    throw new Error(`Preflight gagal:\n- ${problems.join("\n- ")}`);
  }

  const admin =
    (await db.user.findFirst({
      where: { username: ADMIN_USERNAME, role: "ADMIN", isActive: true },
      select: { id: true },
    })) ??
    (await db.user.create({
      data: {
        username: ADMIN_USERNAME,
        email: "qa-p3-product-admin@example.test",
        passwordHash: "qa_test_hash",
        role: "ADMIN",
        isActive: true,
      },
      select: { id: true },
    }));

  const category =
    (await db.category.findFirst({
      where: { name: QA_CATEGORY, deletedAt: null },
      select: { id: true },
    })) ??
    (await db.category.create({
      data: { name: QA_CATEGORY },
      select: { id: true },
    }));

  const unit =
    (await db.unit.findFirst({
      where: { name: QA_UNIT, deletedAt: null },
      select: { id: true },
    })) ??
    (await db.unit.create({
      data: { name: QA_UNIT },
      select: { id: true },
    }));

  return { adminId: admin.id, categoryId: category.id, unitId: unit.id };
}

function requirePreflight(): Preflight {
  if (!pre) throw new Error("Preflight belum dijalankan.");
  return pre;
}

describe.skipIf(!ENABLED)("integrasi impor produk (koperasi_test_db)", () => {
  beforeAll(async () => {
    pre = await runPreflight();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("T1: produk baru stok nol tanpa StockMovement", async () => {
    const { adminId } = requirePreflight();
    const { buffer, mapping } = productWorkbook([
      { sku: SKU_ZERO, name: "QA Barang Stok Nol", openingStock: "0" },
    ]);

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-zero.xlsx",
      buffer,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.successRows).toBe(1);
    const product = await db.product.findUniqueOrThrow({
      where: { sku: SKU_ZERO },
    });
    expect(product.stock).toBe(0);
    const movements = await db.stockMovement.count({
      where: { productId: product.id },
    });
    expect(movements).toBe(0);
  }, TEST_TIMEOUT_MS);

  it("T2: produk baru stok positif + movement IMPORT", async () => {
    const { adminId } = requirePreflight();
    const { buffer, mapping } = productWorkbook([
      { sku: SKU_STK, name: "QA Barang Stok 10", openingStock: "10" },
    ]);

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-stk.xlsx",
      buffer,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.successRows).toBe(1);
    const product = await db.product.findUniqueOrThrow({
      where: { sku: SKU_STK },
    });
    expect(product.stock).toBe(10);
    const movement = await db.stockMovement.findFirst({
      where: { productId: product.id, type: StockMovementType.IMPORT },
    });
    expect(movement?.qtyChange).toBe(10);
    expect(movement?.stockAfter).toBe(10);
    expect(movement?.refType).toBe("IMPORT");
  }, TEST_TIMEOUT_MS);

  it("T3: SKIP duplikat SKU tidak mengubah stok", async () => {
    const { adminId } = requirePreflight();
    const before = await db.product.findUniqueOrThrow({
      where: { sku: SKU_STK },
    });
    const { buffer, mapping } = productWorkbook([
      { sku: SKU_STK, name: "Duplikat", openingStock: "99" },
    ]);

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-skip.xlsx",
      buffer,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.skippedRows).toBe(1);
    const after = await db.product.findUniqueOrThrow({ where: { sku: SKU_STK } });
    expect(after.stock).toBe(before.stock);
    expect(after.name).toBe(before.name);
  }, TEST_TIMEOUT_MS);

  it("T4: ERROR duplikat SKU dan ImportLog metadata", async () => {
    const { adminId } = requirePreflight();
    const { buffer, mapping } = productWorkbook([
      { sku: SKU_STK, name: "Duplikat ERROR" },
    ]);

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-err.xlsx",
      buffer,
      mapping,
      duplicateMode: "ERROR",
    });

    expect(result.failedRows).toBe(1);
    const log = await getImportLogById(result.importLogId);
    const meta = parseImportLogMetadata(log?.mappingJson);
    expect(meta?.errors?.[0]?.message).toContain("mode error");
  }, TEST_TIMEOUT_MS);

  it("T5: UPDATE nama tanpa mengubah stok", async () => {
    const { adminId } = requirePreflight();
    const headers = PRODUCT_FIELDS.map((f) => f.label);
    const row: Record<string, string> = {
      sku: SKU_UPD,
      name: "QA UPD Awal",
      categoryName: QA_CATEGORY,
      unitName: QA_UNIT,
      costPrice: "5000",
      sellPrice: "7000",
      openingStock: "0",
    };
    const createBuf = buildXlsxBufferFromRows("Barang", headers, [
      PRODUCT_FIELDS.map((f) => row[f.key] ?? ""),
    ]);
    const createMap = suggestColumnMapping(headers, "PRODUCTS");
    await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-upd-create.xlsx",
      buffer: createBuf,
      mapping: createMap,
      duplicateMode: "SKIP",
    });

    const updateRow: Record<string, string> = {
      ...row,
      name: "QA UPD Diubah",
    };
    const stockBefore = (
      await db.product.findUniqueOrThrow({ where: { sku: SKU_UPD } })
    ).stock;
    const updBuf = buildXlsxBufferFromRows("Barang", headers, [
      PRODUCT_FIELDS.map((f) => {
        if (f.key === "openingStock") return "";
        return updateRow[f.key] ?? "";
      }),
    ]);
    const updMap = suggestColumnMapping(headers, "PRODUCTS");

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-upd.xlsx",
      buffer: updBuf,
      mapping: updMap,
      duplicateMode: "UPDATE",
    });

    expect(result.successRows).toBe(1);
    const product = await db.product.findUniqueOrThrow({ where: { sku: SKU_UPD } });
    expect(product.name).toBe("QA UPD Diubah");
    expect(product.stock).toBe(stockBefore);
  }, TEST_TIMEOUT_MS);

  it("T6: UPDATE menolak kolom stok awal terisi", async () => {
    const { adminId } = requirePreflight();
    const headers = PRODUCT_FIELDS.map((f) => f.label);
    const row = productRow({
      sku: SKU_ZERO,
      name: "QA Stok Ditolak",
      openingStock: "5",
    });
    const buffer = buildXlsxBufferFromRows("Barang", headers, [row]);
    const mapping = suggestColumnMapping(headers, "PRODUCTS");

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-upd-stk.xlsx",
      buffer,
      mapping,
      duplicateMode: "UPDATE",
    });

    expect(result.failedRows).toBe(1);
    const meta = parseImportLogMetadata(
      (await getImportLogById(result.importLogId))?.mappingJson
    );
    expect(meta?.errors?.some((e) => e.field === "openingStock")).toBe(true);
  }, TEST_TIMEOUT_MS);

  it("T7: kategori tidak valid tanpa insert produk", async () => {
    const { adminId } = requirePreflight();
    const { buffer, mapping } = productWorkbook([
      {
        sku: "QA-P3-PROD-BADCAT",
        name: "Kategori Salah",
        categoryName: "QA-Kategori-Tidak-Ada",
      },
    ]);

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-badcat.xlsx",
      buffer,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.failedRows).toBe(1);
    expect(
      await db.product.count({ where: { sku: "QA-P3-PROD-BADCAT" } })
    ).toBe(0);
  }, TEST_TIMEOUT_MS);

  it("T8: AuditLog IMPORT_EXECUTE tercatat", async () => {
    const { adminId } = requirePreflight();
    const { buffer, mapping } = productWorkbook([
      { sku: "QA-P3-PROD-AUD2", name: "QA Audit 2", openingStock: "0" },
    ]);

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-prod-audit2.xlsx",
      buffer,
      mapping,
      duplicateMode: "SKIP",
    });

    const audit = await db.auditLog.findFirst({
      where: {
        action: "IMPORT_EXECUTE",
        entity: "ImportLog",
        entityId: result.importLogId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(adminId);
  }, TEST_TIMEOUT_MS);
});