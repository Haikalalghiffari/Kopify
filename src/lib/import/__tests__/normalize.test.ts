import { describe, it, expect } from "vitest";
import {
  normalizeSku,
  parseDateStrict,
  parseIntegerStrict,
  parsePhoneAsString,
  parseRupiahStrict,
} from "../normalize";

describe("normalize import", () => {
  it("mengubah SKU menjadi huruf besar", () => {
    expect(normalizeSku(" brg-001 ")).toBe("BRG-001");
  });

  it("mem-parse rupiah format Indonesia dan internasional", () => {
    expect(parseRupiahStrict("1.500.000").value).toBe(1500000);
    expect(parseRupiahStrict("1,500,000").value).toBe(1500000);
    expect(parseRupiahStrict("Rp 1.500.000").value).toBe(1500000);
  });

  it("menolak rupiah dengan desimal non-nol", () => {
    const bad = parseRupiahStrict("1.500,50");
    expect(bad.ok).toBe(false);
  });

  it("menerima pemisah ribuan 1.500 sebagai 1500", () => {
    expect(parseRupiahStrict("1.500").value).toBe(1500);
  });

  it("mem-parse stok bilangan bulat", () => {
    expect(parseIntegerStrict("10").value).toBe(10);
    expect(parseIntegerStrict("1.000").value).toBe(1000);
  });

  it("mem-parse tanggal Indonesia dan ISO", () => {
    const id = parseDateStrict("15/11/2026");
    const iso = parseDateStrict("2026-11-15");
    expect(id.ok).toBe(true);
    expect(iso.ok).toBe(true);
  });

  it("menolak tanggal tidak valid", () => {
    expect(parseDateStrict("32/13/2026").ok).toBe(false);
    expect(parseDateStrict("15/11/26").ok).toBe(false);
  });

  it("mempertahankan telepon sebagai string", () => {
    const res = parsePhoneAsString("081234567890");
    expect(res.ok).toBe(true);
    expect(res.value).toBe("081234567890");
  });
});