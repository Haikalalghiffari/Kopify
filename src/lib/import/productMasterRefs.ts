import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trimToEmpty } from "./normalize";
import type {
  NormalizedProductRow,
  RowFieldError,
  RowValidationSummary,
  ValidatedImportRow,
} from "./types";

export function masterNameKey(name: string): string {
  return trimToEmpty(name).toLowerCase();
}

export type CategoryUnitMaps = {
  categoryByKey: Map<string, { id: string; name: string }>;
  unitByKey: Map<string, { id: string; name: string }>;
};

export async function loadCategoryUnitMaps(
  client: Prisma.TransactionClient | typeof db = db
): Promise<CategoryUnitMaps> {
  const [categories, units] = await Promise.all([
    client.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    }),
    client.unit.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const categoryByKey = new Map<string, { id: string; name: string }>();
  for (const c of categories) {
    categoryByKey.set(masterNameKey(c.name), c);
  }

  const unitByKey = new Map<string, { id: string; name: string }>();
  for (const u of units) {
    unitByKey.set(masterNameKey(u.name), u);
  }

  return { categoryByKey, unitByKey };
}

export function categoryUnitErrorsForRow(
  row: NormalizedProductRow,
  maps: CategoryUnitMaps
): RowFieldError[] {
  const errors: RowFieldError[] = [];
  const category = maps.categoryByKey.get(masterNameKey(row.categoryName));
  if (!category) {
    errors.push({
      field: "categoryName",
      message: `Kategori "${row.categoryName}" tidak ditemukan di master data.`,
    });
  }
  const unit = maps.unitByKey.get(masterNameKey(row.unitName));
  if (!unit) {
    errors.push({
      field: "unitName",
      message: `Satuan "${row.unitName}" tidak ditemukan di master data.`,
    });
  }
  return errors;
}

export function resolveCategoryId(
  row: NormalizedProductRow,
  maps: CategoryUnitMaps
): string | null {
  return maps.categoryByKey.get(masterNameKey(row.categoryName))?.id ?? null;
}

export function resolveUnitId(
  row: NormalizedProductRow,
  maps: CategoryUnitMaps
): string | null {
  return maps.unitByKey.get(masterNameKey(row.unitName))?.id ?? null;
}

/**
 * Memvalidasi referensi master tanpa menulis database (preview / pra-eksekusi).
 */
export function applyProductMasterValidation(
  summary: RowValidationSummary,
  maps: CategoryUnitMaps
): RowValidationSummary {
  const rows: ValidatedImportRow<unknown>[] = summary.rows.map((row) => {
    if (!row.data || row.errors.length > 0) return row;
    const data = row.data as NormalizedProductRow;
    const refErrors = categoryUnitErrorsForRow(data, maps);
    if (refErrors.length === 0) {
      return row;
    }
    return {
      ...row,
      data: null,
      errors: [...row.errors, ...refErrors],
    };
  });

  const validCount = rows.filter(
    (r) => r.data !== null && r.errors.length === 0
  ).length;

  return {
    totalRows: summary.totalRows,
    validCount,
    invalidCount: rows.length - validCount,
    rows,
  };
}