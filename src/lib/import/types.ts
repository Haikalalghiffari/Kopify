export type ImportDataType = "MEMBERS" | "PRODUCTS";

export type ImportFileFormat = "xlsx" | "xls" | "csv";

export type DuplicateHandlingMode = "SKIP" | "UPDATE" | "ERROR";

export interface ImportFieldKey {
  members:
    | "memberNo"
    | "name"
    | "nik"
    | "address"
    | "phone"
    | "email"
    | "joinedAt"
    | "status";
  products:
    | "sku"
    | "name"
    | "categoryName"
    | "unitName"
    | "costPrice"
    | "sellPrice"
    | "openingStock"
    | "minStock"
    | "isActive";
}

export type MemberFieldKey = ImportFieldKey["members"];
export type ProductFieldKey = ImportFieldKey["products"];

export interface FieldDefinition<K extends string = string> {
  key: K;
  label: string;
  required: boolean;
  synonyms: string[];
  description?: string;
}

export interface ParsedCellValue {
  raw: string;
  display: string;
}

export interface ParsedImportRow {
  sourceRowNumber: number;
  cells: Record<string, ParsedCellValue>;
}

export interface ParsedWorksheet {
  name: string;
  headers: string[];
  rows: ParsedImportRow[];
  totalDataRows: number;
}

export interface ParseImportFileResult {
  format: ImportFileFormat;
  filename: string;
  worksheets: { name: string; rowCount: number }[];
  selectedWorksheet: ParsedWorksheet;
}

export type ColumnMapping = Record<string, string | null>;

export interface RowFieldError {
  field: string;
  message: string;
}

export interface ValidatedImportRow<T> {
  sourceRowNumber: number;
  data: T | null;
  errors: RowFieldError[];
  warnings: RowFieldError[];
}

export interface RowValidationSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: ValidatedImportRow<unknown>[];
}

export interface FileValidationSuccess {
  ok: true;
  format: ImportFileFormat;
  sizeBytes: number;
}

export interface FileValidationFailure {
  ok: false;
  message: string;
}

export type FileValidationResult = FileValidationSuccess | FileValidationFailure;

export interface ColumnMappingValidationResult {
  ok: boolean;
  errors: string[];
  mapping: ColumnMapping;
}

export interface NormalizedMemberRow {
  memberNo: string;
  name: string;
  nik: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  joinedAt: Date | null;
  status: "AKTIF" | "NONAKTIF";
  /** Kolom dipetakan dan sel sumber tidak kosong; dipakai payload UPDATE aman. */
  updateProvidedFields?: MemberFieldKey[];
}

export interface NormalizedProductRow {
  sku: string;
  name: string;
  categoryName: string;
  unitName: string;
  costPrice: number;
  sellPrice: number;
  openingStock: number;
  minStock: number;
  isActive: boolean;
  /** Kolom dipetakan dan sel sumber tidak kosong; dipakai payload UPDATE aman. */
  updateProvidedFields?: ProductFieldKey[];
}

export interface ImportValidationOptions {
  strict?: boolean;
  duplicateHandling?: DuplicateHandlingMode;
}