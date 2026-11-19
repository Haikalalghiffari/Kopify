/**
 * Guard keamanan database untuk integration/E2E test P4.
 *
 * Prinsip:
 *  1. Opt-in eksplisit  : RUN_P4_DB_INTEGRATION=1 (atau RUN_P4_E2E=1 untuk Playwright).
 *  2. URL eksplisit     : TEST_DATABASE_URL wajib diisi. TIDAK pernah jatuh kembali ke DATABASE_URL.
 *  3. Nama DB tepat     : "koperasi_test_db" (case-sensitive, tanpa trik query-string).
 *  4. Host lokal saja   : localhost / 127.0.0.1 / ::1.
 *  5. Verifikasi runtime: SELECT current_database() harus sama setelah koneksi terbuka.
 *
 * Modul ini sengaja netral terhadap framework (tanpa import vitest/playwright) agar
 * dipakai bersama oleh vitest (integration) dan Playwright (E2E).
 * Kredensial TIDAK pernah dicetak; gunakan describeTarget() untuk log yang aman.
 */
import { PrismaClient } from "@prisma/client";

export const REQUIRED_TEST_DB_NAME = "koperasi_test_db";
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// Parameter libpq/Prisma yang dapat mengalihkan koneksi ke target lain dari URL.
const FORBIDDEN_PARAMS = ["host", "hostaddr", "dbname", "database", "service", "options", "port"];

/**
 * DATABASE_URL pembangunan seperti saat modul ini pertama dimuat, SEBELUM setup.ts
 * sengaja menimpanya dengan URL uji. Perbandingan "test == dev" harus memakai nilai asli ini;
 * memakai nilai saat ini akan salah menuduh lapisan pertahanan kita sendiri.
 */
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(`[P4 TEST SAFETY] ${message}`);
    this.name = "UnsafeTestDatabaseError";
  }
}

type Env = Record<string, string | undefined>;

export function isDbIntegrationEnabled(env: Env = process.env): boolean {
  return env.RUN_P4_DB_INTEGRATION === "1";
}

export function isE2EEnabled(env: Env = process.env): boolean {
  return env.RUN_P4_E2E === "1";
}

/** Validasi murni (tanpa koneksi). Mengembalikan URL ter-parse bila aman, selain itu melempar. */
export function assertSafeTestDatabaseUrl(raw: string | undefined): URL {
  if (!raw || !raw.trim()) {
    throw new UnsafeTestDatabaseError(
      "TEST_DATABASE_URL belum diisi. Tidak ada fallback ke DATABASE_URL."
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL bukan URL yang valid.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL harus berprotokol postgresql://.");
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (dbName !== REQUIRED_TEST_DB_NAME) {
    throw new UnsafeTestDatabaseError(
      `Nama database harus tepat "${REQUIRED_TEST_DB_NAME}", terdeteksi "${dbName || "(kosong)"}".`
    );
  }

  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsafeTestDatabaseError(
      `Host "${url.hostname}" tidak diizinkan. Hanya localhost/127.0.0.1/::1.`
    );
  }

  for (const key of Array.from(url.searchParams.keys())) {
    if (FORBIDDEN_PARAMS.includes(key.toLowerCase())) {
      throw new UnsafeTestDatabaseError(
        `Parameter URL "${key}" tidak diizinkan karena dapat mengalihkan target koneksi.`
      );
    }
  }

  return url;
}

/**
 * Menyelesaikan URL database uji dari environment secara aman.
 * Juga menolak NODE_ENV=production dan URL yang sama persis dengan DATABASE_URL.
 */
export function resolveTestDatabaseUrl(env: Env = process.env): string {
  if (env.NODE_ENV === "production") {
    throw new UnsafeTestDatabaseError("Integration test tidak boleh berjalan dengan NODE_ENV=production.");
  }
  const url = assertSafeTestDatabaseUrl(env.TEST_DATABASE_URL);
  // Untuk process.env, bandingkan dengan DATABASE_URL asli (setup.ts menimpanya dengan URL uji).
  const devUrl = env === process.env ? ORIGINAL_DATABASE_URL : env.DATABASE_URL;
  if (devUrl && devUrl === env.TEST_DATABASE_URL) {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL.");
  }
  return url.toString();
}

/** Deskripsi target tanpa kredensial, aman dicetak ke log. */
export function describeTarget(rawUrl: string): string {
  const u = new URL(rawUrl);
  return `${u.hostname}:${u.port || "5432"}/${decodeURIComponent(u.pathname.replace(/^\//, ""))} (user & password disembunyikan)`;
}

type GlobalWithClient = typeof globalThis & { __p4TestPrisma?: PrismaClient };

/** Klien Prisma tunggal untuk satu worker, selalu ke database uji yang tervalidasi. */
export function getTestPrisma(): PrismaClient {
  const g = globalThis as GlobalWithClient;
  if (!g.__p4TestPrisma) {
    const safe = new URL(resolveTestDatabaseUrl());
    // Pool lebih besar agar test konkurensi tidak kekurangan koneksi.
    safe.searchParams.set("connection_limit", "20");
    safe.searchParams.set("pool_timeout", "30");
    g.__p4TestPrisma = new PrismaClient({
      datasources: { db: { url: safe.toString() } },
      log: ["error"],
    });
  }
  return g.__p4TestPrisma;
}

/** Bukti runtime bahwa koneksi benar-benar ke koperasi_test_db dan skema sudah termigrasi. */
export async function verifyConnectedDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ db: string; has_orders: boolean }[]>`
    SELECT current_database() AS db, to_regclass('public.orders') IS NOT NULL AS has_orders`;
  const row = rows[0];
  if (!row || row.db !== REQUIRED_TEST_DB_NAME) {
    throw new UnsafeTestDatabaseError(
      `Koneksi aktif ke "${row?.db}" padahal wajib "${REQUIRED_TEST_DB_NAME}". Dihentikan.`
    );
  }
  if (!row.has_orders) {
    throw new UnsafeTestDatabaseError(
      `Skema belum termigrasi pada ${REQUIRED_TEST_DB_NAME} (tabel orders tidak ada).`
    );
  }
}

/**
 * Modul pengganti untuk vi.mock("@/lib/db"):
 *  - aktif   -> klien uji tervalidasi
 *  - nonaktif-> proxy yang MELEMPAR bila disentuh, sehingga mustahil diam-diam memakai DATABASE_URL.
 */
export function dbMockModule(): { db: PrismaClient; default: PrismaClient } {
  if (isDbIntegrationEnabled()) {
    const client = getTestPrisma();
    return { db: client, default: client };
  }
  const trap = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        throw new UnsafeTestDatabaseError(
          `Akses db.${String(prop)} diblokir: integration test tidak diaktifkan (RUN_P4_DB_INTEGRATION != 1).`
        );
      },
    }
  ) as PrismaClient;
  return { db: trap, default: trap };
}
