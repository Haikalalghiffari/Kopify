import { PaymentMethod, PaymentStatus } from "@prisma/client";

export class PaymentFieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentFieldError";
  }
}

const PAYMENT_METHODS = new Set<string>(Object.values(PaymentMethod));
const PAYMENT_STATUSES = new Set<string>(Object.values(PaymentStatus));

export function parsePaymentMethodInput(value: unknown): PaymentMethod | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !PAYMENT_METHODS.has(value)) {
    throw new PaymentFieldError("Metode pembayaran tidak valid.");
  }
  return value as PaymentMethod;
}

export function parsePaymentStatusInput(value: unknown): PaymentStatus | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !PAYMENT_STATUSES.has(value)) {
    throw new PaymentFieldError("Status pembayaran tidak valid.");
  }
  return value as PaymentStatus;
}

export function resolveSalePaymentFields(
  method?: PaymentMethod,
  status?: PaymentStatus
): { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus } {
  const paymentMethod = method ?? "TUNAI";
  if (status !== undefined) {
    return { paymentMethod, paymentStatus: status };
  }
  return {
    paymentMethod,
    paymentStatus: paymentMethod === "BON" ? "BELUM_LUNAS" : "LUNAS",
  };
}