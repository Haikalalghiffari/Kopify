/**
 * Shared Money Utility - Sistem Informasi Koperasi
 * Memastikan semua nilai uang disimpan dan dihitung dalam integer rupiah (tanpa desimal).
 */

/**
 * Memformat angka integer rupiah menjadi representasi string berformat Indonesia:
 * Contoh: 1500000 -> "Rp 1.500.000"
 * @param amount Nilai uang dalam rupiah (integer)
 * @returns String rupiah terformat
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0";
  }

  // Pastikan angka dibulatkan ke integer terdekat jika tidak sengaja menerima float
  const integerAmount = Math.round(amount);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(integerAmount)
    .replace(/\s+/g, " "); // Pastikan spasi konsisten ("Rp 1.500.000")
}

/**
 * Parsing input teks rupiah dari pengguna menjadi integer rupiah.
 * Mendukung format: "1.500.000", "Rp 1.500.000", "1500000", "1,500,000"
 * @param input String yang berisi angka rupiah
 * @returns Integer rupiah murni
 */
export function parseRupiah(input: string | number): number {
  if (typeof input === "number") {
    return Math.round(input);
  }

  if (!input || typeof input !== "string") {
    return 0;
  }

  // Buang karakter 'Rp', titik, spasi, koma
  const sanitized = input
    .replace(/^Rp\s?/i, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .trim();

  const parsed = parseInt(sanitized, 10);
  return isNaN(parsed) ? 0 : parsed;
}
