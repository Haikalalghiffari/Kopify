import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { MAX_IMPORT_FILE_BYTES } from "../constants";
import {
  buildXlsxBufferFromRows,
  parseImportFile,
} from "../parseSpreadsheet";

describe("parseImportFile", () => {
  it("mem-parse CSV dengan header dan baris data", () => {
    const csv = Buffer.from(
      "No Anggota;Nama\nANG-001;Budi Santoso\nANG-002;Siti\n",
      "utf8"
    );
    const parsed = parseImportFile(csv, "anggota.csv");
    expect(parsed.format).toBe("csv");
    expect(parsed.selectedWorksheet.headers).toContain("No Anggota");
    expect(parsed.selectedWorksheet.totalDataRows).toBe(2);
    expect(parsed.selectedWorksheet.rows[0].sourceRowNumber).toBe(2);
  });

  it("mem-parse XLSX multi-baris", () => {
    const buf = buildXlsxBufferFromRows(
      "Data",
      ["SKU", "Nama Barang"],
      [
        ["BRG-001", "Beras"],
        ["BRG-002", "Gula"],
      ]
    );
    const parsed = parseImportFile(buf, "barang.xlsx");
    expect(parsed.format).toBe("xlsx");
    expect(parsed.worksheets.length).toBe(1);
    expect(parsed.selectedWorksheet.totalDataRows).toBe(2);
  });

  it("melempar error untuk file kosong", () => {
    expect(() => parseImportFile(Buffer.alloc(0), "kosong.csv")).toThrow();
  });

  it("melempar error saat ukuran melebihi batas", () => {
    const oversized = Buffer.alloc(MAX_IMPORT_FILE_BYTES + 10, 0x20);
    expect(() => parseImportFile(oversized, "besar.csv")).toThrow(/10 MB/);
  });

  it("mendeteksi beberapa worksheet pada xlsx", () => {
    const sheet1 = buildXlsxBufferFromRows("Sheet1", ["A"], [["1"]]);
    const parsed1 = parseImportFile(sheet1, "a.xlsx");
    expect(parsed1.worksheets[0].name).toBe("Sheet1");
  });

  it("mem-parse workbook .xls (format lama)", () => {
    const buf = buildXlsxBufferFromRows("Legacy", ["SKU"], [["BRG-XLS"]]);
    const wb = XLSX.read(buf, { type: "buffer" });
    const xlsBuf = Buffer.from(
      XLSX.write(wb, { type: "buffer", bookType: "xls" })
    );
    const validated = parseImportFile(xlsBuf, "legacy.xls");
    expect(validated.format).toBe("xls");
    expect(validated.selectedWorksheet.rows[0].cells.SKU.display).toBe("BRG-XLS");
  });
});