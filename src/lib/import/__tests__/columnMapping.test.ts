import { describe, it, expect } from "vitest";
import {
  suggestColumnMapping,
  validateColumnMapping,
} from "../columnMapping";

describe("columnMapping", () => {
  it("menyarankan pemetaan otomatis untuk header umum", () => {
    const headers = ["No Anggota", "Nama Lengkap", "No HP"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");
    expect(mapping["No Anggota"]).toBe("memberNo");
    expect(mapping["Nama Lengkap"]).toBe("name");
    expect(mapping["No HP"]).toBe("phone");
  });

  it("mendeteksi kolom wajib yang belum dipetakan", () => {
    const headers = ["Nama"];
    const mapping = suggestColumnMapping(headers, "MEMBERS");
    const result = validateColumnMapping(headers, mapping, "MEMBERS");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Nomor Anggota"))).toBe(true);
  });

  it("mendeteksi pemetaan ganda ke field yang sama", () => {
    const headers = ["Kode", "SKU"];
    const mapping = {
      Kode: "sku",
      SKU: "sku",
    };
    const result = validateColumnMapping(headers, mapping, "PRODUCTS");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/lebih dari satu kolom/i);
  });
});