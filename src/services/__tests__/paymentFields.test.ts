import { describe, it, expect } from "vitest";
import {
  parsePaymentMethodInput,
  parsePaymentStatusInput,
  resolveSalePaymentFields,
  PaymentFieldError,
} from "../paymentFields";

describe("paymentFields", () => {
  it("rejects unknown payment method", () => {
    expect(() => parsePaymentMethodInput("CRYPTO")).toThrow(PaymentFieldError);
  });

  it("rejects unknown payment status", () => {
    expect(() => parsePaymentStatusInput("CICILAN")).toThrow(PaymentFieldError);
  });

  it("defaults non-BON to LUNAS", () => {
    expect(resolveSalePaymentFields("TUNAI")).toEqual({
      paymentMethod: "TUNAI",
      paymentStatus: "LUNAS",
    });
  });

  it("defaults BON to BELUM_LUNAS", () => {
    expect(resolveSalePaymentFields("BON")).toEqual({
      paymentMethod: "BON",
      paymentStatus: "BELUM_LUNAS",
    });
  });

  it("preserves explicit payment status", () => {
    expect(resolveSalePaymentFields("TRANSFER", "BELUM_LUNAS")).toEqual({
      paymentMethod: "TRANSFER",
      paymentStatus: "BELUM_LUNAS",
    });
  });
});