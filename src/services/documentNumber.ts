import { Prisma } from "@prisma/client";
import { TIMEZONE_WIB } from "@/lib/date";

type Tx = Prisma.TransactionClient;

export type DocumentKind = "ORD" | "SLS";

/** Tanggal kalender WIB (Asia/Jakarta) sebagai YYYYMMDD. */
export function wibYmdCompact(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

/**
 * Urutan tertinggi yang sudah dipakai untuk prefix harian.
 * Memakai MAX(sufiks) — bukan COUNT — supaya nomor tetap unik walau ada baris
 * yang terhapus (celah/gap) di tengah urutan.
 */
async function maxSequence(tx: Tx, kind: DocumentKind, prefix: string): Promise<number> {
  const start = prefix.length + 1;
  const like = `${prefix}%`;
  const rows =
    kind === "ORD"
      ? await tx.$queryRaw<{ max_seq: number }[]>(Prisma.sql`
          SELECT COALESCE(MAX(CAST(SUBSTRING("order_no" FROM ${start}::int) AS INTEGER)), 0)::int AS max_seq
          FROM "orders"
          WHERE "order_no" LIKE ${like}
            AND SUBSTRING("order_no" FROM ${start}::int) ~ '^[0-9]+$'`)
      : await tx.$queryRaw<{ max_seq: number }[]>(Prisma.sql`
          SELECT COALESCE(MAX(CAST(SUBSTRING("sale_no" FROM ${start}::int) AS INTEGER)), 0)::int AS max_seq
          FROM "sales"
          WHERE "sale_no" LIKE ${like}
            AND SUBSTRING("sale_no" FROM ${start}::int) ~ '^[0-9]+$'`);
  return Number(rows[0]?.max_seq ?? 0);
}

/**
 * Menghasilkan nomor ORD-YYYYMMDD-XXXX atau SLS-YYYYMMDD-XXXX.
 * Menggunakan pg_advisory_xact_lock per prefix harian agar aman dari race condition.
 * Semua penjualan (dari pesanan maupun POS) memakai prefix SLS yang sama, sehingga
 * berbagi satu lock. Kolom order_no/sale_no tetap UNIQUE sebagai pengaman terakhir.
 */
export async function nextDocumentNumber(tx: Tx, kind: DocumentKind): Promise<string> {
  const prefix = `${kind}-${wibYmdCompact()}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
  const next = (await maxSequence(tx, kind, prefix)) + 1;
  return prefix + String(next).padStart(4, "0");
}