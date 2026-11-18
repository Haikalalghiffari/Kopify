import { describe, it, expect } from "vitest";
import { formatPaymentLine } from "../paymentLabels";

describe("paymentLabels", () => {
  it("formats payment method and status", () => {
    expect(formatPaymentLine("BON", "BELUM_LUNAS")).toBe("Bon · Belum lunas");
    expect(formatPaymentLine("TRANSFER", "LUNAS")).toBe("Transfer · Lunas");
  });
});