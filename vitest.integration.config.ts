import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Konfigurasi KHUSUS integration test P4 (PostgreSQL).
 *
 *  - Hanya menjalankan berkas *.integration.ts (tidak tertangkap oleh `npm test` biasa).
 *  - Suite otomatis di-skip kecuali RUN_P4_DB_INTEGRATION=1 dan TEST_DATABASE_URL valid
 *    (lihat src/tests/p4/support/safeDb.ts).
 *  - Berkas dijalankan berurutan (tanpa paralel antar-file) karena berbagi satu database.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/tests/p4/**/*.integration.ts"],
    setupFiles: ["src/tests/p4/support/setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
