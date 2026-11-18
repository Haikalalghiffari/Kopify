import { describe, it, expect } from "vitest";
import { buildCatalogProductWhere } from "../catalogQuery";

describe("buildCatalogProductWhere", () => {
  it("scopes to active products only", () => {
    const where = buildCatalogProductWhere({});
    expect(where.isActive).toBe(true);
    expect(where.deletedAt).toBeNull();
  });

  it("filters by category", () => {
    const where = buildCatalogProductWhere({ categoryId: "cat-1" });
    expect(where.categoryId).toBe("cat-1");
  });

  it("searches name and sku case-insensitively", () => {
    const where = buildCatalogProductWhere({ q: "kopi" });
    expect(where.OR).toEqual([
      { name: { contains: "kopi", mode: "insensitive" } },
      { sku: { contains: "kopi", mode: "insensitive" } },
    ]);
  });
});