import type { DuplicateHandlingMode, ColumnMapping, RowFieldError } from "@/lib/import/types";

export const MEMBER_IMPORT_BATCH_SIZE = 100;
export const PRODUCT_IMPORT_BATCH_SIZE = 50;

export interface MemberImportInput {
  userId: string;
  filename: string;
  buffer: Buffer;
  mapping: ColumnMapping;
  duplicateMode: DuplicateHandlingMode;
  strict?: boolean;
  worksheetName?: string;
}

export type RowImportOutcome = "created" | "updated" | "skipped" | "failed";

export interface MemberRowImportResult {
  sourceRowNumber: number;
  outcome: RowImportOutcome;
  errors: RowFieldError[];
}

export interface MemberImportResult {
  totalRows: number;
  validationFailedCount: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  rowResults: MemberRowImportResult[];
}

export interface ProductImportInput {
  userId: string;
  importLogId: string;
  filename: string;
  buffer: Buffer;
  mapping: ColumnMapping;
  duplicateMode: DuplicateHandlingMode;
  strict?: boolean;
  worksheetName?: string;
}

export interface ProductRowImportResult {
  sourceRowNumber: number;
  outcome: RowImportOutcome;
  errors: RowFieldError[];
}

export interface ProductImportResult {
  totalRows: number;
  validationFailedCount: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  rowResults: ProductRowImportResult[];
}