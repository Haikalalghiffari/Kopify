import { PREVIEW_ROW_LIMIT } from "./constants";
import type {
  ColumnMapping,
  ImportDataType,
  RowFieldError,
  ValidatedImportRow,
} from "./types";

export interface ParseImportApiResponse {
  success: true;
  format: string;
  filename: string;
  worksheets: { name: string; rowCount: number }[];
  selectedWorksheet: string;
  headers: string[];
  suggestedMapping: ColumnMapping;
  totalDataRows: number;
}

export interface PreviewRowPayload {
  sourceRowNumber: number;
  valid: boolean;
  data: Record<string, unknown> | null;
  errors: RowFieldError[];
  warnings: RowFieldError[];
}

export interface PreviewImportApiResponse {
  success: true;
  mappingErrors: string[];
  mappingValid: boolean;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  previewRows: PreviewRowPayload[];
}

export function toPreviewPayload(
  rows: ValidatedImportRow<unknown>[],
  limit = PREVIEW_ROW_LIMIT
): PreviewRowPayload[] {
  return rows.slice(0, limit).map((row) => ({
    sourceRowNumber: row.sourceRowNumber,
    valid: row.data !== null && row.errors.length === 0,
    data: row.data ? (row.data as Record<string, unknown>) : null,
    errors: row.errors,
    warnings: row.warnings,
  }));
}

export function parseImportType(value: FormDataEntryValue | null): ImportDataType | null {
  if (value === "MEMBERS" || value === "PRODUCTS") return value;
  return null;
}