import { describe, it, expect } from "vitest";
import { MAX_STORED_ERROR_ROWS, toStoredErrors } from "../importLogMeta";

describe("importLogMeta", () => {
  it("membatasi jumlah error yang disimpan di metadata", () => {
    const rows = Array.from({ length: MAX_STORED_ERROR_ROWS + 10 }, (_, i) => ({
      sourceRowNumber: i + 2,
      errors: [{ field: "nama", message: `err ${i}` }],
    }));
    const stored = toStoredErrors(rows);
    expect(stored.length).toBe(MAX_STORED_ERROR_ROWS);
  });
});