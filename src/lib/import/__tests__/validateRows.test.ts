import { describe, it, expect } from "vitest";
import { suggestColumnMapping } from "../columnMapping";
import type { ParsedWorksheet } from "../types";
import { validateImportRows } from "../validateRows";

const memberWorksheet: ParsedWorksheet = {
  name: "Sheet1",
  headers: ["No Anggota", "Nama", "Harga", "Stok"],
  totalDataRows: 2,
  rows: [
    {
      sourceRowNumber: 2,
      cells: {
        "No Anggota": { raw: "ANG-001", display: "ANG-001" },
        Nama: { raw: "Budi", display: "Budi" },
        Harga: { raw: "", display: "" },
        Stok: { raw: "", display: "" },
      },
    },
    {
      sourceRowNumber: 3,
      cells: {
        "No Anggota": { raw: "ANG-001", display: "ANG-001" },
        Nama: { raw: "Budi duplikat", display: "Budi duplikat" },
        Harga: { raw: "", display: "" },
        Stok: { raw: "", display: "" },
      },
    },
  ],
};

describe("validateImportRows", () => {
  it("memvalidasi anggota valid dan mendeteksi duplikat file", () => {
    const headers = ["No Anggota", "Nama"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");
    const summary = validateImportRows("MEMBERS", memberWorksheet, mapping);
    expect(summary.totalRows).toBe(2);
    expect(summary.validCount).toBe(1);
    expect(summary.invalidCount).toBe(1);
    const dup = summary.rows.find((r) => r.sourceRowNumber === 3);
    expect(dup?.errors.some((e) => e.message.includes("duplikat"))).toBe(true);
  });

  it("menolak produk tanpa kolom harga wajib", () => {
    const ws: ParsedWorksheet = {
      name: "Sheet1",
      headers: ["SKU", "Nama Barang", "Kategori", "Satuan"],
      totalDataRows: 1,
      rows: [
        {
          sourceRowNumber: 2,
          cells: {
            SKU: { raw: "BRG-1", display: "BRG-1" },
            "Nama Barang": { raw: "Beras", display: "Beras" },
            Kategori: { raw: "Sembako", display: "Sembako" },
            Satuan: { raw: "Kg", display: "Kg" },
          },
        },
      ],
    };
    const mapping = suggestColumnMapping(ws.headers, "PRODUCTS");
    const summary = validateImportRows("PRODUCTS", ws, mapping);
    expect(summary.validCount).toBe(0);
    expect(summary.rows[0].errors.length).toBeGreaterThan(0);
  });
});