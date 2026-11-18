import { Prisma, StockMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { validateColumnMapping } from "@/lib/import/columnMapping";
import {
  categoryUnitErrorsForRow,
  loadCategoryUnitMaps,
  resolveCategoryId,
  resolveUnitId,
  type CategoryUnitMaps,
} from "@/lib/import/productMasterRefs";
import { parseImportFile } from "@/lib/import/parseSpreadsheet";
import type {
  ColumnMapping,
  DuplicateHandlingMode,
  NormalizedProductRow,
  ProductFieldKey,
  ValidatedImportRow,
} from "@/lib/import/types";
import { validateImportRows } from "@/lib/import/validateRows";
import type { IStockService } from "@/services/contracts";
import { resolveStockService } from "./stockGateway";
import {
  PRODUCT_IMPORT_BATCH_SIZE,
  type ProductImportInput,
  type ProductImportResult,
  type ProductRowImportResult,
} from "./types";

type ExistingProduct = {
  id: string;
  sku: string;
  deletedAt: Date | null;
};

function productCreateData(
  row: NormalizedProductRow,
  maps: CategoryUnitMaps
) {
  const categoryId = resolveCategoryId(row, maps);
  const unitId = resolveUnitId(row, maps);
  if (!categoryId || !unitId) {
    throw new Error("Referensi kategori atau satuan tidak valid.");
  }
  return {
    sku: row.sku,
    name: row.name,
    categoryId,
    unitId,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    stock: 0,
    minStock: row.minStock,
    isActive: row.isActive,
  };
}

export function buildProductUpdateData(
  row: NormalizedProductRow,
  maps: CategoryUnitMaps
): Prisma.ProductUpdateInput {
  const provided = new Set(row.updateProvidedFields ?? []);
  const data: Prisma.ProductUpdateInput = { name: row.name };

  if (provided.has("categoryName")) {
    const categoryId = resolveCategoryId(row, maps);
    if (categoryId) data.category = { connect: { id: categoryId } };
  }
  if (provided.has("unitName")) {
    const unitId = resolveUnitId(row, maps);
    if (unitId) data.unit = { connect: { id: unitId } };
  }
  if (provided.has("costPrice")) data.costPrice = row.costPrice;
  if (provided.has("sellPrice")) data.sellPrice = row.sellPrice;
  if (provided.has("minStock")) data.minStock = row.minStock;
  if (provided.has("isActive")) data.isActive = row.isActive;

  return data;
}

function updateAttemptsOpeningStock(row: NormalizedProductRow): boolean {
  const provided = new Set(row.updateProvidedFields ?? []);
  return provided.has("openingStock");
}

async function loadExistingBySkus(
  skus: string[],
  client: Prisma.TransactionClient | typeof db
): Promise<Map<string, ExistingProduct>> {
  if (skus.length === 0) return new Map();
  const rows = await client.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true, deletedAt: true },
  });
  return new Map(rows.map((r) => [r.sku, r]));
}

function handleExistingProduct(
  duplicateMode: DuplicateHandlingMode,
  existing: ExistingProduct
):
  | { kind: "skip" }
  | { kind: "fail"; message: string }
  | { kind: "update"; id: string }
  | { kind: "error_duplicate" } {
  if (existing.deletedAt) {
    return {
      kind: "fail",
      message:
        "Barang dengan SKU ini pernah dihapus (soft delete). Pulihkan lewat Master Data sebelum impor.",
    };
  }

  switch (duplicateMode) {
    case "SKIP":
      return { kind: "skip" };
    case "UPDATE":
      return { kind: "update", id: existing.id };
    case "ERROR":
      return { kind: "error_duplicate" };
    default:
      return { kind: "error_duplicate" };
  }
}

function prismaErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(", ")
        : "unik";
      return `Pelanggaran data unik (${target}).`;
    }
  }
  return "Gagal menyimpan ke database.";
}

async function applyOpeningStock(
  stockService: IStockService,
  params: {
    productId: string;
    qty: number;
    importLogId: string;
    userId: string;
    filename: string;
  },
  tx: Prisma.TransactionClient
): Promise<void> {
  if (params.qty <= 0) return;

  await stockService.adjustStock(
    {
      productId: params.productId,
      qtyChange: params.qty,
      type: StockMovementType.IMPORT,
      refType: "IMPORT",
      refId: params.importLogId,
      note: `Stok awal impor file ${params.filename}`,
      userId: params.userId,
    },
    tx
  );
}

async function processBatch(
  batch: ValidatedImportRow<NormalizedProductRow>[],
  duplicateMode: DuplicateHandlingMode,
  maps: CategoryUnitMaps,
  stockService: IStockService,
  meta: { userId: string; importLogId: string; filename: string },
  client: Prisma.TransactionClient
): Promise<ProductRowImportResult[]> {
  const skus = batch
    .map((b) => b.data?.sku)
    .filter((s): s is string => Boolean(s));
  const existingMap = await loadExistingBySkus(skus, client);
  const results: ProductRowImportResult[] = [];

  for (const row of batch) {
    if (!row.data) continue;
    const data = row.data;

    const refErrors = categoryUnitErrorsForRow(data, maps);
    if (refErrors.length > 0) {
      results.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "failed",
        errors: refErrors,
      });
      continue;
    }

    const existing = existingMap.get(data.sku);

    try {
      if (existing) {
        const decision = handleExistingProduct(duplicateMode, existing);
        if (decision.kind === "skip") {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "skipped",
            errors: [],
          });
          continue;
        }
        if (decision.kind === "fail") {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "failed",
            errors: [{ field: "sku", message: decision.message }],
          });
          continue;
        }
        if (decision.kind === "error_duplicate") {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "failed",
            errors: [
              {
                field: "sku",
                message: "SKU sudah ada di database (mode error).",
              },
            ],
          });
          continue;
        }
        if (updateAttemptsOpeningStock(data)) {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "failed",
            errors: [
              {
                field: "openingStock",
                message:
                  "Stok awal tidak dapat diperbarui untuk barang yang sudah ada. Gunakan modul stok P2.",
              },
            ],
          });
          continue;
        }
        await client.product.update({
          where: { id: decision.id },
          data: buildProductUpdateData(data, maps),
        });
        results.push({
          sourceRowNumber: row.sourceRowNumber,
          outcome: "updated",
          errors: [],
        });
        continue;
      }

      const created = await client.product.create({
        data: productCreateData(data, maps),
      });
      try {
        await applyOpeningStock(
          stockService,
          {
            productId: created.id,
            qty: data.openingStock,
            importLogId: meta.importLogId,
            userId: meta.userId,
            filename: meta.filename,
          },
          client
        );
      } catch (stockErr) {
        await client.product.delete({ where: { id: created.id } });
        results.push({
          sourceRowNumber: row.sourceRowNumber,
          outcome: "failed",
          errors: [
            {
              field: "openingStock",
              message:
                stockErr instanceof Error
                  ? stockErr.message
                  : "Gagal mencatat stok awal.",
            },
          ],
        });
        continue;
      }

      existingMap.set(data.sku, {
        id: created.id,
        sku: data.sku,
        deletedAt: null,
      });
      results.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "created",
        errors: [],
      });
    } catch (err) {
      results.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "failed",
        errors: [{ field: "sku", message: prismaErrorMessage(err) }],
      });
    }
  }

  return results;
}

export async function importProductsFromFile(
  input: ProductImportInput
): Promise<ProductImportResult> {
  const stockService = await resolveStockService();
  if (!stockService) {
    throw new Error("stockService P2 belum tersedia untuk impor barang.");
  }

  const parsed = parseImportFile(input.buffer, input.filename, {
    worksheetName: input.worksheetName,
  });

  const headers = parsed.selectedWorksheet.headers;
  const mappingCheck = validateColumnMapping(
    headers,
    input.mapping,
    "PRODUCTS"
  );
  if (!mappingCheck.ok) {
    throw new Error(mappingCheck.errors.join(" "));
  }

  const maps = await loadCategoryUnitMaps();

  const validation = validateImportRows(
    "PRODUCTS",
    parsed.selectedWorksheet,
    input.mapping,
    { strict: input.strict, duplicateHandling: input.duplicateMode }
  );

  const rowResults: ProductRowImportResult[] = [];

  for (const row of validation.rows) {
    if (row.data === null || row.errors.length > 0) {
      rowResults.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "failed",
        errors: row.errors.length
          ? row.errors
          : [{ field: "_row", message: "Baris tidak valid." }],
      });
    }
  }

  const syntacticallyValid = validation.rows.filter(
    (r) => r.data !== null && r.errors.length === 0
  ) as ValidatedImportRow<NormalizedProductRow>[];

  const validRows: ValidatedImportRow<NormalizedProductRow>[] = [];
  for (const row of syntacticallyValid) {
    const data = row.data!;
    const refErrors = categoryUnitErrorsForRow(data, maps);
    if (refErrors.length > 0) {
      rowResults.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "failed",
        errors: refErrors,
      });
    } else {
      validRows.push(row);
    }
  }

  const meta = {
    userId: input.userId,
    importLogId: input.importLogId,
    filename: input.filename,
  };

  for (let i = 0; i < validRows.length; i += PRODUCT_IMPORT_BATCH_SIZE) {
    const slice = validRows.slice(i, i + PRODUCT_IMPORT_BATCH_SIZE);
    try {
      const batchResults = await db.$transaction(async (tx) => {
        const batchMaps = await loadCategoryUnitMaps(tx);
        return processBatch(
          slice,
          input.duplicateMode,
          batchMaps,
          stockService,
          meta,
          tx
        );
      });
      rowResults.push(...batchResults);
    } catch {
      for (const row of slice) {
        rowResults.push({
          sourceRowNumber: row.sourceRowNumber,
          outcome: "failed",
          errors: [
            {
              field: "_batch",
              message:
                "Batch gagal dan di-rollback. Coba impor ulang baris ini.",
            },
          ],
        });
      }
    }
  }

  let successRows = 0;
  let skippedRows = 0;
  let failedRows = 0;

  for (const r of rowResults) {
    if (r.outcome === "created" || r.outcome === "updated") successRows++;
    else if (r.outcome === "skipped") skippedRows++;
    else failedRows++;
  }

  return {
    totalRows: validation.totalRows,
    validationFailedCount: validation.invalidCount,
    successRows,
    failedRows,
    skippedRows,
    rowResults,
  };
}

export type ProductUpdateField = ProductFieldKey;