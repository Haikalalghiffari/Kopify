import * as XLSX from "xlsx";
import { validateImportFile } from "./fileValidation";
import { parseCsvBuffer } from "./parseCsv";
import type {
  ImportFileFormat,
  ParseImportFileResult,
  ParsedImportRow,
  ParsedWorksheet,
} from "./types";
import { cellToRawString } from "./normalize";

export interface ParseImportFileOptions {
  worksheetName?: string;
}

function isBlankRow(values: unknown[]): boolean {
  return values.every((v) => cellToRawString(v).trim() === "");
}

function extractCellDisplay(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim() !== "") {
    return String(cell.w);
  }
  if (cell.v == null) return "";
  if (cell.t === "d" && cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }
  return cellToRawString(cell.v);
}

function worksheetToParsed(sheet: XLSX.WorkSheet, name: string): ParsedWorksheet {
  const ref = sheet["!ref"];
  if (!ref) {
    throw new Error(`Worksheet "${name}" kosong.`);
  }

  const range = XLSX.utils.decode_range(ref);
  const matrix: unknown[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      row.push(extractCellDisplay(cell));
    }
    matrix.push(row);
  }

  let headerRowIndex = -1;
  for (let i = 0; i < matrix.length; i++) {
    if (!isBlankRow(matrix[i])) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex < 0) {
    throw new Error(`Worksheet "${name}" tidak memiliki header.`);
  }

  const headerRow = matrix[headerRowIndex] as string[];
  const headers = headerRow.map((h, idx) => {
    const label = cellToRawString(h).trim();
    return label || `Kolom_${idx + 1}`;
  });

  const rows: ParsedImportRow[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (isBlankRow(line)) continue;

    const cells: ParsedImportRow["cells"] = {};
    headers.forEach((header, colIdx) => {
      const display = cellToRawString(line[colIdx] ?? "");
      cells[header] = { raw: display, display };
    });

    rows.push({
      sourceRowNumber: i + 1,
      cells,
    });
  }

  if (rows.length === 0) {
    throw new Error(`Worksheet "${name}" tidak memiliki baris data setelah header.`);
  }

  return {
    name,
    headers,
    rows,
    totalDataRows: rows.length,
  };
}

function parseExcelBuffer(
  buffer: Buffer,
  format: ImportFileFormat,
  options?: ParseImportFileOptions
): ParseImportFileResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    bookVBA: false,
  });

  if (!workbook.SheetNames.length) {
    throw new Error("Workbook tidak memiliki worksheet.");
  }

  const worksheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const parsed = worksheetToParsed(sheet, name);
    return { name, rowCount: parsed.totalDataRows };
  });

  const selectedName =
    options?.worksheetName && workbook.SheetNames.includes(options.worksheetName)
      ? options.worksheetName
      : workbook.SheetNames[0];

  const selectedSheet = workbook.Sheets[selectedName];
  const selectedWorksheet = worksheetToParsed(selectedSheet, selectedName);

  return {
    format,
    filename: "",
    worksheets,
    selectedWorksheet,
  };
}

export function parseImportFile(
  buffer: Buffer,
  filename: string,
  options?: ParseImportFileOptions
): ParseImportFileResult {
  const validated = validateImportFile(buffer, filename);
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  if (validated.format === "csv") {
    const selectedWorksheet = parseCsvBuffer(buffer);
    return {
      format: "csv",
      filename,
      worksheets: [{ name: selectedWorksheet.name, rowCount: selectedWorksheet.totalDataRows }],
      selectedWorksheet,
    };
  }

  const result = parseExcelBuffer(buffer, validated.format, options);
  result.filename = filename;
  return result;
}

export function buildXlsxBufferFromRows(
  sheetName: string,
  headers: string[],
  rows: string[][]
): Buffer {
  const aoa = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}