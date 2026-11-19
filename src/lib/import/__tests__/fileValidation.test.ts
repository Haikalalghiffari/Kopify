import { describe, it, expect } from "vitest";
import { MAX_IMPORT_FILE_BYTES } from "../constants";
import { validateImportFile } from "../fileValidation";
import { buildXlsxBufferFromRows } from "../parseSpreadsheet";

describe("validateImportFile", () => {
  it("menolak ekstensi tidak didukung", () => {
    const res = validateImportFile(Buffer.from("data"), "data.pdf");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toMatch(/tidak didukung/i);
    }
  });

  it("menolak file kosong", () => {
    const res = validateImportFile(Buffer.alloc(0), "data.csv");
    expect(res.ok).toBe(false);
  });

  it("menolak file lebih besar dari 10 MB", () => {
    const big = Buffer.alloc(MAX_IMPORT_FILE_BYTES + 1, 0x20);
    const res = validateImportFile(big, "besar.csv");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toMatch(/10 MB/);
    }
  });

  it("menerima CSV teks valid", () => {
    const csv = Buffer.from("nama,sku\nBudi,BRG-1\n", "utf8");
    const res = validateImportFile(csv, "anggota.csv");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.format).toBe("csv");
    }
  });

  it("menerima buffer xlsx valid", () => {
    const xlsx = buildXlsxBufferFromRows("Sheet1", ["nama"], [["Budi"]]);
    const res = validateImportFile(xlsx, "data.xlsx");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.format).toBe("xlsx");
    }
  });

  it("menolak ketidakcocokan ekstensi dan isi", () => {
    const xlsx = buildXlsxBufferFromRows("Sheet1", ["nama"], [["Budi"]]);
    const res = validateImportFile(xlsx, "data.csv");
    expect(res.ok).toBe(false);
  });
});