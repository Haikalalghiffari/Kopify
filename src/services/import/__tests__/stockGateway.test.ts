import { describe, it, expect } from "vitest";
import {
  isProductImportExecutionAllowed,
  resolveStockService,
} from "../stockGateway";

describe("stockGateway", () => {
  it("menghubungkan ke stockService P2", async () => {
    const service = await resolveStockService();
    expect(service).not.toBeNull();
    expect(typeof service?.adjustStock).toBe("function");
    const gate = await isProductImportExecutionAllowed();
    expect(gate.allowed).toBe(true);
  });
});