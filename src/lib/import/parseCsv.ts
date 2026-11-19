import Papa from "papaparse";
import type { ParsedImportRow, ParsedWorksheet } from "./types";

function isRowBlank(cells: string[]): boolean {
  return cells.every((c) => !c || !c.trim());
}

function detectDelimiter(sample: string): string | undefined {
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  if (semicolons > commas) return ";";
  if (commas > 0) return ",";
  return undefined;
}

export function parseCsvBuffer(buffer: Buffer, worksheetName = "CSV"): ParsedWorksheet {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const delimiter = detectDelimiter(text.slice(0, 2048));

  const parsed = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: false,
    header: false,
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(
      first.message
        ? `Gagal membaca CSV: ${first.message}`
        : "Gagal membaca file CSV."
    );
  }

  const table = parsed.data as string[][];
  if (!table.length) {
    throw new Error("Worksheet kosong atau tidak memiliki data.");
  }

  let headerIndex = -1;
  for (let i = 0; i < table.length; i++) {
    const row = table[i].map((c) => (c ?? "").trim());
    if (!isRowBlank(row)) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error("Tidak ditemukan baris header pada file CSV.");
  }

  const headers = table[headerIndex].map((h, idx) => {
    const label = (h ?? "").trim();
    return label || `Kolom_${idx + 1}`;
  });

  const rows: ParsedImportRow[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const line = table[i] ?? [];
    if (isRowBlank(line.map((c) => c ?? ""))) continue;

    const cells: Record<string, { raw: string; display: string }> = {};
    headers.forEach((header, colIdx) => {
      const val = line[colIdx] ?? "";
      const display = String(val);
      cells[header] = { raw: display, display };
    });

    rows.push({
      sourceRowNumber: i + 1,
      cells,
    });
  }

  if (rows.length === 0) {
    throw new Error("Tidak ada baris data setelah header pada file CSV.");
  }

  return {
    name: worksheetName,
    headers,
    rows,
    totalDataRows: rows.length,
  };
}