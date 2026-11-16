/**
 * Laporan error: otorisasi handler + struktur workbook (metadata mirip log T2).
 */
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const getImportLogById = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

vi.mock("@/services/import/importService", () => ({
  getImportLogById: (...args: unknown[]) => getImportLogById(...args),
}));

const T2_LOG_ID = "cmwiwlfro000632pk0x8fxzum";

const t2LikeLog = {
  id: T2_LOG_ID,
  filename: "Kopify_P3_Contoh_Import_Anggota.xlsx",
  mappingJson: {
    version: 1,
    duplicateMode: "ERROR",
    skippedRows: 0,
    errors: [
      { sourceRowNumber: 2, field: "memberNo", message: "=CMD|x" },
      { sourceRowNumber: 3, field: "memberNo", message: "Nomor anggota sudah ada di database (mode error)." },
      { sourceRowNumber: 4, field: "memberNo", message: "Nomor anggota sudah ada di database (mode error)." },
      { sourceRowNumber: 5, field: "memberNo", message: "Nomor anggota sudah ada di database (mode error)." },
      { sourceRowNumber: 6, field: "memberNo", message: "Nomor anggota sudah ada di database (mode error)." },
    ],
  },
};

describe("GET /api/admin/import/history/[id]/errors", () => {
  beforeEach(() => {
    requireRole.mockReset();
    getImportLogById.mockReset();
  });

  it("menolak tanpa sesi", async () => {
    requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const { GET } = await import("../history/[id]/errors/route");
    const res = await GET(new NextRequest("http://localhost"), {
      params: { id: T2_LOG_ID },
    });
    expect(res.status).toBe(403);
  });

  it("mengembalikan XLSX valid untuk log gagal", async () => {
    requireRole.mockResolvedValue({ id: "admin", role: Role.ADMIN });
    getImportLogById.mockResolvedValue(t2LikeLog);
    const { GET } = await import("../history/[id]/errors/route");
    const res = await GET(new NextRequest("http://localhost"), {
      params: { id: T2_LOG_ID },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/error-Kopify_P3_Contoh_Import_Anggota\.xlsx/);

    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows).toHaveLength(5);
    expect(Number(rows[0]["Nomor Baris"])).toBe(2);
    expect(rows[0]["Field"]).toBe("memberNo");
    expect(rows[0]["Pesan Error"]).toMatch(/^'/);
    expect(rows[0]["Pesan Error"]).toContain("=CMD");
  });
});