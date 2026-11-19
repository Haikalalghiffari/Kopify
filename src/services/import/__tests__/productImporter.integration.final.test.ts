/**
 * Verifikasi terfokus PostgreSQL (hanya SKU FINAL baru).
 *
 *   $env:TEST_DATABASE_URL="...@localhost:5433/koperasi_test_db?schema=public"
 *   $env:P3_PRODUCT_DB_FINAL="1"
 *   npx vitest run src/services/import/__tests__/productImporter.integration.final.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { suggestColumnMapping } from "@/lib/import/columnMapping";
import { PRODUCT_FIELDS } from "@/lib/import/fields";
import { buildXlsxBufferFromRows } from "@/lib/import/parseSpreadsheet";
import type { ColumnMapping } from "@/lib/import/types";

const SKU_UPD = "QA-P3-FINAL-UPD-001";
const SKU_AUD = "QA-P3-FINAL-AUD-001";
const QA_CATEGORY = "QA-P3-Master-Sembako";
const QA_UNIT = "QA-P3-Master-Kg";
const ADMIN_USERNAME = "qa-p3-product-admin";

const { testDbUrl, ENABLED } = vi.hoisted(() => {
  const enabled = process.env.P3_PRODUCT_DB_FINAL === "1";

  // Test tidak aktif secara default.
  // Jangan validasi DATABASE_URL CI jika suite memang tidak dijalankan.
  if (!enabled) {
    return {
      testDbUrl:
        "postgresql://disabled:disabled@localhost:5433/koperasi_test_db?schema=public",
      ENABLED: false,
    };
  }

  // Validasi hanya berjalan ketika test diaktifkan secara eksplisit.
  const url =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL?.replace(
      /\/koperasi_db(\?|$)/,
      "/koperasi_test_db$1"
    ) ||
    "postgresql://koperasi_user:koperasi_pass@localhost:5433/koperasi_test_db?schema=public";

  const parsedUrl = new URL(url);
  const dbName = parsedUrl.pathname
    .replace(/^\//, "")
    .split("?")[0]
    .toLowerCase();

  if (
    parsedUrl.hostname !== "localhost" ||
    parsedUrl.port !== "5433"
  ) {
    throw new Error("Hanya localhost:5433 diizinkan.");
  }

  if (dbName !== "koperasi_test_db") {
    throw new Error(
      `Hanya koperasi_test_db, terdeteksi "${dbName}".`
    );
  }

  return {
    testDbUrl: url,
    ENABLED: true,
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

const TEST_TIMEOUT_MS = 60_000;

interface Preflight {
  adminId: string;
}

let pre: Preflight | null = null;

function productRow(values: Record<string, string>): string[] {
  return PRODUCT_FIELDS.map((f) => values[f.key] ?? "");
}

async function runPreflight(): Promise<Preflight> {
  const problems: string[] = [];
  if (process.env.NODE_ENV === "production") {
    problems.push("NODE_ENV=production tidak diizinkan.");
  }

  const [{ name: serverDb }] = await db.$queryRaw<
    { name: string }[]
  >`SELECT current_database()::text AS name`;
  if (serverDb !== "koperasi_test_db") {
    problems.push(`current_database() = "${serverDb}".`);
  }

  const migrations = await db.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM _prisma_migrations WHERE finished_at IS NOT NULL
  `;
  if (Number(migrations[0]?.c) < 4) {
    problems.push("Migrasi test DB belum lengkap (harus 4).");
  }

  for (const sku of [SKU_UPD, SKU_AUD]) {
    if ((await db.product.count({ where: { sku } })) > 0) {
      problems.push(`SKU ${sku} sudah ada.`);
    }
  }

  if (
    (await db.category.count({
      where: { name: QA_CATEGORY, deletedAt: null },
    })) === 0
  ) {
    problems.push(`Kategori ${QA_CATEGORY} tidak ditemukan.`);
  }
  if (
    (await db.unit.count({
      where: { name: QA_UNIT, deletedAt: null },
    })) === 0
  ) {
    problems.push(`Satuan ${QA_UNIT} tidak ditemukan.`);
  }

  const admin = await db.user.findFirst({
    where: { username: ADMIN_USERNAME, role: "ADMIN", isActive: true },
    select: { id: true },
  });
  if (!admin) problems.push(`Admin ${ADMIN_USERNAME} tidak ditemukan.`);

  if (problems.length > 0) {
    throw new Error(`Preflight gagal:\n- ${problems.join("\n- ")}`);
  }

  return { adminId: admin!.id };
}

describe.skipIf(!ENABLED)("verifikasi final produk (koperasi_test_db)", () => {
  beforeAll(async () => {
    pre = await runPreflight();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("T5 FINAL: UPDATE field tanpa openingStock, stok tidak berubah", async () => {
    const { adminId } = pre!;
    const headers = PRODUCT_FIELDS.map((f) => f.label);

    const createValues: Record<string, string> = {
      sku: SKU_UPD,
      name: "FINAL UPD Awal",
      categoryName: QA_CATEGORY,
      unitName: QA_UNIT,
      costPrice: "8000",
      sellPrice: "10000",
      openingStock: "5",
    };
    const createBuf = buildXlsxBufferFromRows("Barang", headers, [
      productRow(createValues),
    ]);
    const createMap = suggestColumnMapping(headers, "PRODUCTS");

    const createResult = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-final-upd-create.xlsx",
      buffer: createBuf,
      mapping: createMap,
      duplicateMode: "SKIP",
    });
    expect(createResult.successRows).toBe(1);

    const before = await db.product.findUniqueOrThrow({ where: { sku: SKU_UPD } });
    const movementsBefore = await db.stockMovement.count({
      where: { productId: before.id },
    });

    const updateValues: Record<string, string> = {
      ...createValues,
      name: "FINAL UPD Diubah",
      sellPrice: "11500",
    };
    const updBuf = buildXlsxBufferFromRows("Barang", headers, [
      PRODUCT_FIELDS.map((f) => {
        if (f.key === "openingStock") return "";
        return updateValues[f.key] ?? "";
      }),
    ]);
    const updMap = suggestColumnMapping(headers, "PRODUCTS");

    const updateResult = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-final-upd.xlsx",
      buffer: updBuf,
      mapping: updMap,
      duplicateMode: "UPDATE",
    });

    expect(updateResult.successRows).toBe(1);
    const after = await db.product.findUniqueOrThrow({ where: { sku: SKU_UPD } });
    expect(after.name).toBe("FINAL UPD Diubah");
    expect(after.sellPrice).toBe(11500);
    expect(after.stock).toBe(before.stock);
    expect(after.costPrice).toBe(before.costPrice);
    expect(
      await db.stockMovement.count({ where: { productId: before.id } })
    ).toBe(movementsBefore);
  }, TEST_TIMEOUT_MS);

  it("T8 FINAL: AuditLog by ImportLog ID", async () => {
    const { adminId } = pre!;
    const headers = PRODUCT_FIELDS.map((f) => f.label);
    const values: Record<string, string> = {
      sku: SKU_AUD,
      name: "FINAL Audit Produk",
      categoryName: QA_CATEGORY,
      unitName: QA_UNIT,
      costPrice: "3000",
      sellPrice: "4000",
      openingStock: "0",
    };
    const buffer = buildXlsxBufferFromRows("Barang", headers, [productRow(values)]);
    const mapping = suggestColumnMapping(headers, "PRODUCTS");

    const result = await executeImport({
      userId: adminId,
      importType: "PRODUCTS",
      filename: "qa-final-aud.xlsx",
      buffer,
      mapping,
      duplicateMode: "SKIP",
    });

    expect(result.status).toBe("SUCCESS");
    const log = await getImportLogById(result.importLogId);
    expect(log?.filename).toBe("qa-final-aud.xlsx");
    expect(log?.successRows).toBe(1);

    const audit = await db.auditLog.findFirst({
      where: {
        action: "IMPORT_EXECUTE",
        entity: "ImportLog",
        entityId: result.importLogId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(adminId);
    const detail = audit?.detailJson as Record<string, unknown> | null;
    expect(detail?.type).toBe("PRODUCTS");
    expect(detail?.status).toBe(result.status);
    expect(detail?.filename).toBe("qa-final-aud.xlsx");
  }, TEST_TIMEOUT_MS);
});