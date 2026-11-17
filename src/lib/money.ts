/**
 * Format integer (rupiah) to display string
 * e.g. 1500000 -> "Rp 1.500.000"
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse Indonesian number string to integer
 * Handles both "1.500.000", "1,500,000", "1500000", or with "Rp" prefix and trailing ",00"
 */
export function parseRupiah(value: string | number): number {
  if (typeof value === "number") return Math.round(value);
  if (!value) return 0;

  let cleaned = value.toString().trim().replace(/[Rp\s]/gi, "");

  // If there's a decimal at the end like ,00 or .00, remove it
  cleaned = cleaned.replace(/[,.]00$/, "");

  // Remove any remaining dots or commas used as thousand separators
  cleaned = cleaned.replace(/[\.,]/g, "");

  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}
