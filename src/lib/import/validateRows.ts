import { applyMappingToRow } from "./columnMapping";
import {
  emptyToNull,
  normalizeActiveFlag,
  normalizeCode,
  normalizeMemberNo,
  normalizeMemberStatus,
  normalizeSku,
  parseDateStrict,
  parseIntegerStrict,
  parsePhoneAsString,
  parseRupiahStrict,
  trimToEmpty,
} from "./normalize";
import type {
  ColumnMapping,
  ImportDataType,
  ImportValidationOptions,
  MemberFieldKey,
  ProductFieldKey,
  NormalizedMemberRow,
  NormalizedProductRow,
  ParsedWorksheet,
  RowFieldError,
  RowValidationSummary,
  ValidatedImportRow,
} from "./types";

const MEMBER_UPDATE_OPTIONAL_KEYS: MemberFieldKey[] = [
  "nik",
  "address",
  "phone",
  "email",
  "joinedAt",
  "status",
];

function memberUpdateProvidedFields(
  mapped: Record<string, string>
): MemberFieldKey[] {
  const provided: MemberFieldKey[] = [];
  for (const key of MEMBER_UPDATE_OPTIONAL_KEYS) {
    if (!(key in mapped)) continue;
    if (trimToEmpty(mapped[key]) === "") continue;
    provided.push(key);
  }
  return provided;
}

const PRODUCT_UPDATE_OPTIONAL_KEYS: ProductFieldKey[] = [
  "categoryName",
  "unitName",
  "costPrice",
  "sellPrice",
  "openingStock",
  "minStock",
  "isActive",
];

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._\-]{0,49}$/;

function productUpdateProvidedFields(
  mapped: Record<string, string>
): ProductFieldKey[] {
  const provided: ProductFieldKey[] = [];
  for (const key of PRODUCT_UPDATE_OPTIONAL_KEYS) {
    if (!(key in mapped)) continue;
    if (trimToEmpty(mapped[key]) === "") continue;
    provided.push(key);
  }
  return provided;
}

function mappedRowFromParsed(
  row: ParsedWorksheet["rows"][number],
  mapping: ColumnMapping
): Record<string, string> {
  const source: Record<string, string> = {};
  for (const [header, cell] of Object.entries(row.cells)) {
    source[header] = cell.display;
  }
  return applyMappingToRow(source, mapping);
}

function validateMemberMapped(
  mapped: Record<string, string>,
  strict: boolean
): {
  data: NormalizedMemberRow | null;
  errors: RowFieldError[];
  warnings: RowFieldError[];
} {
  const errors: RowFieldError[] = [];
  const warnings: RowFieldError[] = [];

  const memberNo = normalizeMemberNo(mapped.memberNo);
  if (!memberNo) {
    errors.push({ field: "memberNo", message: "Nomor anggota wajib diisi." });
  }

  const name = trimToEmpty(mapped.name);
  if (!name) {
    errors.push({ field: "name", message: "Nama anggota wajib diisi." });
  }

  const nik = emptyToNull(mapped.nik ?? "");
  if (nik && !/^\d{16}$/.test(nik)) {
    errors.push({ field: "nik", message: "NIK harus 16 digit angka jika diisi." });
  }

  const phoneResult = parsePhoneAsString(mapped.phone);
  if (!phoneResult.ok) {
    errors.push({
      field: "phone",
      message: phoneResult.message ?? "Nomor telepon tidak valid.",
    });
  } else if (phoneResult.warning) {
    const item = { field: "phone", message: phoneResult.warning };
    if (strict) errors.push(item);
    else warnings.push(item);
  }

  const emailRaw = emptyToNull(mapped.email ?? "");
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    errors.push({ field: "email", message: "Format email tidak valid." });
  }

  const joined = parseDateStrict(mapped.joinedAt);
  if (!joined.ok) {
    errors.push({
      field: "joinedAt",
      message: joined.message ?? "Tanggal bergabung tidak valid.",
    });
  }

  const statusNorm = normalizeMemberStatus(mapped.status);
  const status = statusNorm ?? "AKTIF";

  if (mapped.status && !statusNorm) {
    errors.push({
      field: "status",
      message: "Status harus AKTIF atau NONAKTIF.",
    });
  }

  if (errors.length > 0) {
    return { data: null, errors, warnings };
  }

  return {
    data: {
      memberNo,
      name,
      nik,
      address: emptyToNull(mapped.address ?? ""),
      phone: phoneResult.value,
      email: emailRaw ? emailRaw.toLowerCase() : null,
      joinedAt: joined.value,
      status,
      updateProvidedFields: memberUpdateProvidedFields(mapped),
    },
    errors,
    warnings,
  };
}

function validateProductMapped(
  mapped: Record<string, string>,
  strict: boolean
): {
  data: NormalizedProductRow | null;
  errors: RowFieldError[];
  warnings: RowFieldError[];
} {
  const errors: RowFieldError[] = [];
  const warnings: RowFieldError[] = [];

  const sku = normalizeSku(mapped.sku);
  if (!sku) {
    errors.push({ field: "sku", message: "SKU wajib diisi." });
  } else if (!SKU_PATTERN.test(sku)) {
    errors.push({
      field: "sku",
      message:
        "Format SKU tidak valid. Gunakan huruf, angka, titik, strip, atau underscore (maks. 50 karakter).",
    });
  }

  const name = trimToEmpty(mapped.name);
  if (!name) {
    errors.push({ field: "name", message: "Nama barang wajib diisi." });
  }

  const categoryName = trimToEmpty(mapped.categoryName);
  if (!categoryName) {
    errors.push({ field: "categoryName", message: "Kategori wajib diisi." });
  }

  const unitName = trimToEmpty(mapped.unitName);
  if (!unitName) {
    errors.push({ field: "unitName", message: "Satuan wajib diisi." });
  }

  const cost = parseRupiahStrict(mapped.costPrice);
  if (!cost.ok || cost.value === null) {
    errors.push({
      field: "costPrice",
      message: cost.message ?? "Harga beli wajib diisi dan harus bilangan bulat rupiah.",
    });
  }

  const sell = parseRupiahStrict(mapped.sellPrice);
  if (!sell.ok || sell.value === null) {
    errors.push({
      field: "sellPrice",
      message: sell.message ?? "Harga jual wajib diisi dan harus bilangan bulat rupiah.",
    });
  }

  if (cost.value != null && sell.value != null && sell.value < cost.value) {
    warnings.push({
      field: "sellPrice",
      message: "Harga jual lebih rendah dari harga beli.",
    });
    if (strict) {
      errors.push({
        field: "sellPrice",
        message: "Harga jual tidak boleh lebih rendah dari harga beli (mode ketat).",
      });
    }
  }

  const opening = parseIntegerStrict(mapped.openingStock);
  if (!opening.ok) {
    errors.push({
      field: "openingStock",
      message: opening.message ?? "Stok awal tidak valid.",
    });
  } else if (opening.value != null && opening.value < 0) {
    errors.push({ field: "openingStock", message: "Stok awal tidak boleh negatif." });
  }

  const minStock = parseIntegerStrict(mapped.minStock);
  if (!minStock.ok) {
    errors.push({
      field: "minStock",
      message: minStock.message ?? "Stok minimum tidak valid.",
    });
  } else if (minStock.value != null && minStock.value < 0) {
    errors.push({ field: "minStock", message: "Stok minimum tidak boleh negatif." });
  }

  const activeNorm = normalizeActiveFlag(mapped.isActive);
  const isActive = activeNorm ?? true;
  if (mapped.isActive && activeNorm === null) {
    errors.push({
      field: "isActive",
      message: "Status aktif harus Ya/Tidak atau AKTIF/NONAKTIF.",
    });
  }

  if (errors.length > 0) {
    return { data: null, errors, warnings };
  }

  return {
    data: {
      sku,
      name,
      categoryName,
      unitName,
      costPrice: cost.value ?? 0,
      sellPrice: sell.value ?? 0,
      openingStock: opening.value ?? 0,
      minStock: minStock.value ?? 5,
      isActive,
      updateProvidedFields: productUpdateProvidedFields(mapped),
    },
    errors,
    warnings,
  };
}

function duplicateKeyForType(
  type: ImportDataType,
  data: NormalizedMemberRow | NormalizedProductRow
): string {
  if ("memberNo" in data) {
    return normalizeCode(data.memberNo);
  }
  return normalizeCode(data.sku);
}

export function validateImportRows(
  importType: ImportDataType,
  worksheet: ParsedWorksheet,
  mapping: ColumnMapping,
  options?: ImportValidationOptions
): RowValidationSummary {
  const strict = options?.strict ?? false;
  const rows: ValidatedImportRow<unknown>[] = [];
  const seenKeys = new Map<string, number>();

  for (const row of worksheet.rows) {
    const mapped = mappedRowFromParsed(row, mapping);
    const result =
      importType === "MEMBERS"
        ? validateMemberMapped(mapped, strict)
        : validateProductMapped(mapped, strict);

    const errors = [...result.errors];
    const warnings = [...result.warnings];

    if (result.data) {
      const key = duplicateKeyForType(importType, result.data);
      const firstRow = seenKeys.get(key);
      if (firstRow != null) {
        const label = importType === "MEMBERS" ? "Nomor anggota" : "SKU";
        errors.push({
          field: importType === "MEMBERS" ? "memberNo" : "sku",
          message: `${label} duplikat dalam file (sama dengan baris ${firstRow}).`,
        });
      } else {
        seenKeys.set(key, row.sourceRowNumber);
      }
    }

    const valid = errors.length === 0 && result.data !== null;

    rows.push({
      sourceRowNumber: row.sourceRowNumber,
      data: valid ? result.data : null,
      errors,
      warnings,
    });
  }

  const validCount = rows.filter((r) => r.data !== null && r.errors.length === 0).length;

  return {
    totalRows: rows.length,
    validCount,
    invalidCount: rows.length - validCount,
    rows,
  };
}