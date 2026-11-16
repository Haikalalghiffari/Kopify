import { describe, it, expect } from "vitest";
import {
  isProductImportExecutionAllowed,
  resolveStockService,
} from "../stockGateway";

describe("stockGateway", () => {
  it("belum menyediakan stockService P2", async () => {
    expect(await resolveStockService()).toBeNull();
    const gate = await isProductImportExecutionAllowed();
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("stockService");
  });
});