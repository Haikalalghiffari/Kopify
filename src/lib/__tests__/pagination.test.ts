import { describe, it, expect } from "vitest";
import { normalizePagination, getPaginationMeta } from "../pagination";

describe("Pagination Utility (P1)", () => {
  it("menormalisasi query parameter page dan pageSize", () => {
    const p1 = normalizePagination({ page: 2, pageSize: 20 });
    expect(p1.page).toBe(2);
    expect(p1.pageSize).toBe(20);
    expect(p1.skip).toBe(20);
    expect(p1.take).toBe(20);

    // Negative / NaN fallback
    const p2 = normalizePagination({ page: -1, pageSize: 0 });
    expect(p2.page).toBe(1);
    expect(p2.pageSize).toBe(10);
    expect(p2.skip).toBe(0);
  });

  it("menghasilkan metadata paginasi lengkap", () => {
    const meta = getPaginationMeta(95, 3, 20); // total 95, page 3, size 20 -> 5 pages
    expect(meta.totalItems).toBe(95);
    expect(meta.totalPages).toBe(5);
    expect(meta.page).toBe(3);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(true);

    // Last page
    const lastMeta = getPaginationMeta(95, 5, 20);
    expect(lastMeta.hasNextPage).toBe(false);
    expect(lastMeta.hasPrevPage).toBe(true);

    // First page
    const firstMeta = getPaginationMeta(95, 1, 20);
    expect(firstMeta.hasPrevPage).toBe(false);
    expect(firstMeta.hasNextPage).toBe(true);
  });
});
