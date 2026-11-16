/**
 * Shared Date & Time Utilities - Sistem Informasi Koperasi
 * Menggunakan zona waktu standar Indonesia Barat: Asia/Jakarta (WIB = UTC+7).
 * Hari awal pekan dihitung mulai hari Senin sesuai PRD.
 */

export const TIMEZONE_WIB = "Asia/Jakarta";
const WIB_OFFSET_HOURS = 7;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Mengonversi tanggal ke komponen tanggal lokal di zona waktu Asia/Jakarta.
 */
function getWIBDateParts(d: Date | string | number) {
  const dateObj = new Date(d);
  // Tambahkan offset UTC+7 untuk mendapatkan waktu relatif WIB
  const utcTime = dateObj.getTime() + dateObj.getTimezoneOffset() * 60 * 1000;
  const wibTime = new Date(utcTime + WIB_OFFSET_HOURS * MS_PER_HOUR);

  return {
    year: wibTime.getFullYear(),
    month: wibTime.getMonth(), // 0 - 11
    date: wibTime.getDate(),
    day: wibTime.getDay(), // 0 (Sun) - 6 (Sat)
  };
}

/**
 * Membuat objek Date UTC yang mewakili jam 00:00:00.000 di zona WIB.
 */
function createWIBMidnight(year: number, month: number, date: number): Date {
  // Midnight WIB (00:00:00) sama dengan jam 17:00:00 UTC hari sebelumnya
  return new Date(Date.UTC(year, month, date, -WIB_OFFSET_HOURS, 0, 0, 0));
}

/**
 * Mengembalikan batas awal hari (00:00:00.000 WIB) untuk tanggal yang diberikan.
 */
export function startOfDayWIB(d: Date | string | number = new Date()): Date {
  const { year, month, date } = getWIBDateParts(d);
  return createWIBMidnight(year, month, date);
}

/**
 * Mengembalikan batas akhir hari (23:59:59.999 WIB) untuk tanggal yang diberikan.
 */
export function endOfDayWIB(d: Date | string | number = new Date()): Date {
  const start = startOfDayWIB(d);
  return new Date(start.getTime() + MS_PER_DAY - 1);
}

/**
 * Mengembalikan batas awal pekan (Senin 00:00:00.000 WIB) untuk tanggal yang diberikan.
 * Berdasarkan ISO-8601 & PRD: Pekan dimulai pada hari Senin.
 */
export function startOfWeekWIB(d: Date | string | number = new Date()): Date {
  const { year, month, date, day } = getWIBDateParts(d);
  // day: 0 (Sun), 1 (Mon), ..., 6 (Sat)
  // Jarak mundur ke hari Senin: jika Minggu (0) -> mundur 6 hari; jika 1 (Mon) -> mundur 0 hari.
  const diffToMonday = day === 0 ? 6 : day - 1;
  return createWIBMidnight(year, month, date - diffToMonday);
}

/**
 * Mengembalikan batas awal bulan (Tanggal 1 pukul 00:00:00.000 WIB).
 */
export function startOfMonthWIB(d: Date | string | number = new Date()): Date {
  const { year, month } = getWIBDateParts(d);
  return createWIBMidnight(year, month, 1);
}

/**
 * Mengembalikan batas awal tahun (1 Januari pukul 00:00:00.000 WIB).
 */
export function startOfYearWIB(d: Date | string | number = new Date()): Date {
  const { year } = getWIBDateParts(d);
  return createWIBMidnight(year, 0, 1);
}

/**
 * Format tanggal ke format lokal Indonesia (misal: "16 November 2026").
 */
export function formatDateWIB(
  d: Date | string | number | null | undefined,
  includeTime = false
): string {
  if (!d) return "-";
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_WIB,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(includeTime && {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  }).format(dateObj);
}
