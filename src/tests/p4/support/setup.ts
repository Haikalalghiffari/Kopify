/**
 * Setup file untuk vitest.integration.config.ts.
 * Berjalan sebelum setiap file test. Bila integration diaktifkan:
 *   - memvalidasi TEST_DATABASE_URL (gagal-cepat bila tidak aman)
 *   - mengarahkan process.env.DATABASE_URL ke database uji sebagai lapis pertahanan kedua,
 *     sehingga PrismaClient liar sekalipun tidak akan menyentuh koperasi_db.
 * Bila tidak diaktifkan: tidak melakukan apa pun (seluruh suite akan di-skip).
 */
import { beforeAll } from "vitest";
import {
  describeTarget,
  getTestPrisma,
  isDbIntegrationEnabled,
  resolveTestDatabaseUrl,
  verifyConnectedDatabase,
} from "./safeDb";

if (isDbIntegrationEnabled()) {
  const url = resolveTestDatabaseUrl(); // melempar bila tidak aman
  process.env.DATABASE_URL = url;

  beforeAll(async () => {
    await verifyConnectedDatabase(getTestPrisma());
    // Dicetak di dalam hook (bukan saat collect) agar `vitest list` tidak memakai reporter console.
    // eslint-disable-next-line no-console
    console.info(`[P4 integration] target terverifikasi: ${describeTarget(url)}`);
  });
}
