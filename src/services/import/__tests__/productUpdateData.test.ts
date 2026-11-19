import { describe, expect, it } from "vitest";
import type { NormalizedProductRow } from "@/lib/import/types";
import type { CategoryUnitMaps } from "@/lib/import/productMasterRefs";
import { buildProductUpdateData } from "../productImporter";

const maps: CategoryUnitMaps = {
  categoryByKey: new Map([["sembako", { id: "cat-1", name: "Sembako" }]]),
  unitByKey: new Map([["kg", { id: "unit-1", name: "Kg" }]]),
};

const baseRow: NormalizedProductRow = {
  sku: "BRG-1",
  name: "Nama Baru",
  categoryName: "Sembako",
  unitName: "Kg",
  costPrice: 10000,
  sellPrice: 12000,
  openingStock: 10,
  minStock: 2,
  isActive: true,
};

describe("buildProductUpdateData", () => {
  it("hanya memperbarui nama jika tidak ada field opsional terisi", () => {
    expect(
      buildProductUpdateData({ ...baseRow, updateProvidedFields: [] }, maps)
    ).toEqual({ name: "Nama Baru" });
  });

  it("harga kosong tidak ikut jika tidak provided", () => {
    const data = buildProductUpdateData(
      { ...baseRow, updateProvidedFields: ["minStock"] },
      maps
    );
    expect(data.costPrice).toBeUndefined();
    expect(data.sellPrice).toBeUndefined();
    expect(data.minStock).toBe(2);
  });

  it("kategori dan satuan hanya jika provided", () => {
    const data = buildProductUpdateData(
      {
        ...baseRow,
        updateProvidedFields: ["categoryName", "costPrice"],
      },
      maps
    );
    expect(data.category).toEqual({ connect: { id: "cat-1" } });
    expect(data.unit).toBeUndefined();
    expect(data.costPrice).toBe(10000);
  });
});