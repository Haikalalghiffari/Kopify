import { ImportStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { resolveImportStatus } from "../importService";

const counts = (
  totalRows: number,
  successRows: number,
  skippedRows: number,
  failedRows: number
) => ({ totalRows, successRows, skippedRows, failedRows });

describe("resolveImportStatus", () => {
  it("SUCCESS jika semua baris berhasil", () => {
    expect(resolveImportStatus(counts(5, 5, 0, 0))).toBe(ImportStatus.SUCCESS);
  });

  it("SUCCESS jika semua baris dilewati (mode SKIP)", () => {
    expect(resolveImportStatus(counts(5, 0, 5, 0))).toBe(ImportStatus.SUCCESS);
  });

  it("SUCCESS jika sebagian berhasil dan sebagian dilewati", () => {
    expect(resolveImportStatus(counts(5, 3, 2, 0))).toBe(ImportStatus.SUCCESS);
  });

  it("PARTIAL jika sebagian berhasil dan sebagian gagal", () => {
    expect(resolveImportStatus(counts(5, 3, 0, 2))).toBe(ImportStatus.PARTIAL);
  });

  it("PARTIAL jika berhasil, dilewati, dan gagal bercampur", () => {
    expect(resolveImportStatus(counts(5, 2, 1, 2))).toBe(ImportStatus.PARTIAL);
  });

  it("FAILED jika semua baris gagal", () => {
    expect(resolveImportStatus(counts(5, 0, 0, 5))).toBe(ImportStatus.FAILED);
  });

  it("FAILED jika baris dilewati disertai baris gagal tanpa baris berhasil", () => {
    expect(resolveImportStatus(counts(5, 0, 2, 3))).toBe(ImportStatus.FAILED);
  });

  it("FAILED untuk input tanpa baris data", () => {
    expect(resolveImportStatus(counts(0, 0, 0, 0))).toBe(ImportStatus.FAILED);
  });

  it("PARTIAL, bukan SUCCESS, jika jumlah tidak konsisten dengan total", () => {
    expect(resolveImportStatus(counts(5, 2, 1, 0))).toBe(ImportStatus.PARTIAL);
    expect(resolveImportStatus(counts(3, 3, 2, 0))).toBe(ImportStatus.PARTIAL);
  });
});
