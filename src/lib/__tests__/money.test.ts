import { describe, it, expect } from "vitest";
import { formatRupiah, parseRupiah } from "../money";

describe("Money Utility (P1)", () => {
  it("memformat integer rupiah ke format mata uang Indonesia yang tepat", () => {
    // Standard positive amount
    const formatted = formatRupiah(1500000);
    expect(formatted).toMatch(/Rp\s*1\.500\.000/);

    // Small amount
    expect(formatRupiah(5000)).toMatch(/Rp\s*5\.000/);

    // Large amount
    expect(formatRupiah(125000000)).toMatch(/Rp\s*125\.000\.000/);
  });

  it("menangani angka 0, null, dan undefined dengan aman", () => {
    expect(formatRupiah(0)).toMatch(/Rp\s*0/);
    expect(formatRupiah(null)).toMatch(/Rp\s*0/);
    expect(formatRupiah(undefined)).toMatch(/Rp\s*0/);
    expect(formatRupiah(NaN)).toMatch(/Rp\s*0/);
  });

  it("membulatkan input desimal ke integer rupiah terdekat", () => {
    expect(formatRupiah(15000.75)).toMatch(/Rp\s*15\.001/);
    expect(formatRupiah(15000.25)).toMatch(/Rp\s*15\.000/);
  });

  it("mem-parse input string rupiah menjadi integer rupiah murni", () => {
    expect(parseRupiah("1.500.000")).toBe(1500000);
    expect(parseRupiah("Rp 1.500.000")).toBe(1500000);
    expect(parseRupiah("1,500,000")).toBe(1500000);
    expect(parseRupiah(75000)).toBe(75000);
    expect(parseRupiah("")).toBe(0);
  });
});
