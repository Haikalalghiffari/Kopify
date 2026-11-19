import { describe, it, expect } from "vitest";
import { buildImportErrorReportBuffer, sanitizeExportCell } from "../errorReport";

describe("errorReport", () => {
  it("menambahkan prefix pada sel yang berpotensi formula injection", () => {
    expect(sanitizeExportCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(sanitizeExportCell("+123")).toBe("'+123");
    expect(sanitizeExportCell("-1")).toBe("'-1");
    expect(sanitizeExportCell("@cmd")).toBe("'@cmd");
    expect(sanitizeExportCell("nama biasa")).toBe("nama biasa");
  });

  it("menghasilkan buffer xlsx untuk laporan error", () => {
    const buf = buildImportErrorReportBuffer(
      [{ sourceRowNumber: 5, field: "memberNo", message: "=injeksi" }],
      "anggota.xlsx"
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });
});