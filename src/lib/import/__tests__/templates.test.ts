import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildImportTemplateBuffer, templateFilename } from "../templates";

describe("import templates", () => {
  it("menghasilkan workbook anggota yang dapat dibaca", () => {
    const buf = buildImportTemplateBuffer("MEMBERS");
    expect(templateFilename("MEMBERS")).toBe("template-impor-anggota.xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames.length).toBeGreaterThan(0);
  });

  it("menghasilkan workbook barang yang dapat dibaca", () => {
    const buf = buildImportTemplateBuffer("PRODUCTS");
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect((rows[0] as string[]).some((h) => /SKU/i.test(h))).toBe(true);
  });
});