import * as XLSX from "xlsx";
import type { StoredImportErrorRow } from "./importLogMeta";

const FORMULA_PREFIX = /^[=+\-@]/;

export function sanitizeExportCell(value: string): string {
  if (!value) return value;
  if (FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function buildImportErrorReportBuffer(
  errors: StoredImportErrorRow[],
  filename: string
): Buffer {
  const headers = ["Nomor Baris", "Field", "Pesan Error", "File Sumber"];
  const rows = errors.map((e) => [
    String(e.sourceRowNumber),
    sanitizeExportCell(e.field ?? ""),
    sanitizeExportCell(e.message),
    sanitizeExportCell(filename),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Error Impor");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}