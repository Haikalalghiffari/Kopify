import { describe, it, expect } from "vitest";
import { formatRupiah, parseRupiah } from "../src/lib/money";

describe("Money Utility (Rupiah integer)", () => {
  it("formats integer to Indonesian Rupiah currency format without decimals", () => {
    expect(formatRupiah(1500000)).toMatch(/Rp\s?1\.500\.000/);
    expect(formatRupiah(3500)).toMatch(/Rp\s?3\.500/);
    expect(formatRupiah(0)).toMatch(/Rp\s?0/);
  });

  it("parses formatted rupiah strings back to integers", () => {
    expect(parseRupiah("1.500.000")).toBe(1500000);
    expect(parseRupiah("Rp 1.500.000")).toBe(1500000);
    expect(parseRupiah("3,500")).toBe(3500);
  });
});
