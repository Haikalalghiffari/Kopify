import type { ColumnMapping, DuplicateHandlingMode, RowFieldError } from "./types";

export const IMPORT_LOG_META_VERSION = 1;
export const MAX_STORED_ERROR_ROWS = 500;

export interface StoredImportErrorRow {
  sourceRowNumber: number;
  field?: string;
  message: string;
}

export interface ImportLogMetadata {
  version: number;
  mapping: ColumnMapping;
  duplicateMode: DuplicateHandlingMode;
  strict: boolean;
  worksheetName?: string;
  skippedRows: number;
  errors: StoredImportErrorRow[];
  batchSize: number;
}

export function toStoredErrors(
  rows: { sourceRowNumber: number; errors: RowFieldError[] }[]
): StoredImportErrorRow[] {
  const out: StoredImportErrorRow[] = [];
  for (const row of rows) {
    for (const err of row.errors) {
      if (out.length >= MAX_STORED_ERROR_ROWS) return out;
      out.push({
        sourceRowNumber: row.sourceRowNumber,
        field: err.field,
        message: err.message,
      });
    }
  }
  return out;
}

export function parseImportLogMetadata(raw: unknown): ImportLogMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== "number") return null;
  return obj as unknown as ImportLogMetadata;
}