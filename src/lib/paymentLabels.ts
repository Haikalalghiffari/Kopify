export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  TUNAI: "Tunai",
  TRANSFER: "Transfer",
  BON: "Bon",
  LAINNYA: "Lainnya",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  LUNAS: "Lunas",
  BELUM_LUNAS: "Belum lunas",
};

export function formatPaymentLine(method: string, status: string): string {
  const m = PAYMENT_METHOD_LABEL[method] ?? method;
  const s = PAYMENT_STATUS_LABEL[status] ?? status;
  return `${m} · ${s}`;
}