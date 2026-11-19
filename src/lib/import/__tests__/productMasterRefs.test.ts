import { describe, expect, it } from "vitest";
import {
  applyProductMasterValidation,
  categoryUnitErrorsForRow,
} from "../productMasterRefs";
import type { NormalizedProductRow, RowValidationSummary } from "../types";

const maps = {
  categoryByKey: new Map([["sembako", { id: "c1", name: "Sembako" }]]),
  unitByKey: new Map([["kg", { id: "u1", name: "Kg" }]]),
};

const row: NormalizedProductRow = {
  sku: "BRG-1",
  name: "Beras",
  categoryName: "Sembako",
  unitName: "Kg",
  costPrice: 1,
  sellPrice: 2,
  openingStock: 0,
  minStock: 1,
  isActive: true,
};

describe("productMasterRefs", () => {
  it("mendeteksi kategori tidak ada", () => {
    const errors = categoryUnitErrorsForRow(
      { ...row, categoryName: "X" },
      maps
    );
    expect(errors.some((e) => e.field === "categoryName")).toBe(true);
  });

  it("applyProductMasterValidation menurunkan validCount", () => {
    const summary: RowValidationSummary = {
      totalRows: 1,
      validCount: 1,
      invalidCount: 0,
      rows: [
        {
          sourceRowNumber: 2,
          data: { ...row, unitName: "Liter" },
          errors: [],
          warnings: [],
        },
      ],
    };
    const next = applyProductMasterValidation(summary, maps);
    expect(next.validCount).toBe(0);
    expect(next.rows[0].errors.length).toBeGreaterThan(0);
  });
});