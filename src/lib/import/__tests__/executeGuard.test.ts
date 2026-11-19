import { describe, expect, it } from "vitest";
import { isImportExecutionLocked } from "../executeGuard";

describe("isImportExecutionLocked", () => {
  it("tidak mengunci sebelum ada hasil eksekusi", () => {
    expect(isImportExecutionLocked(null)).toBe(false);
  });

  it("mengunci setelah impor SUCCESS", () => {
    expect(isImportExecutionLocked({ status: "SUCCESS" })).toBe(true);
  });

  it("mengunci setelah impor PARTIAL", () => {
    expect(isImportExecutionLocked({ status: "PARTIAL" })).toBe(true);
  });

  it("tidak mengunci jika seluruh baris gagal (FAILED)", () => {
    expect(isImportExecutionLocked({ status: "FAILED" })).toBe(false);
  });
});
