/**
 * Playwright — E2E P4 (Pesanan & Penjualan).
 *
 * KEAMANAN (sengaja berlapis):
 *  - Config ini INERT kecuali RUN_P4_E2E=1: tanpa flag, tidak ada webServer dan tidak ada globalSetup,
 *    sehingga `npx playwright test --list` aman dijalankan kapan saja.
 *  - Saat aktif, TEST_DATABASE_URL divalidasi guard yang sama dengan integration test
 *    (nama DB tepat "koperasi_test_db", host lokal, tanpa parameter pengalih) sebelum server dimulai.
 *  - Server aplikasi SELALU dijalankan dengan DATABASE_URL = URL uji tervalidasi (menimpa .env),
 *    reuseExistingServer=false agar tidak pernah menempel ke server dev yang menunjuk koperasi_db.
 *  - globalSetup membuktikan target: login akun yang di-seed ke test DB lewat server, atau gagal total.
 *  - Data hanya dibuat dengan prefix unik P4E2E-<run> dan dibersihkan berdasarkan id oleh globalTeardown.
 *
 * Prasyarat saat dijalankan (setelah izin): tidak ada `next dev`/`next start` lain yang memakai folder .next
 * proyek ini (server E2E menjalankan `next build` ke .next), dan port 3100 bebas.
 */
import { randomBytes } from "node:crypto";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { isE2EEnabled, resolveTestDatabaseUrl } from "./src/tests/p4/support/safeDb";

const enabled = isE2EEnabled();
const PORT = 3100;
// "localhost" (bukan 127.0.0.1) sengaja: middleware Next membangun URL redirect dengan host "localhost"
// walau server di-bind ke 127.0.0.1. Bila browser memakai host lain, cookie sesi tidak ikut ke tujuan
// redirect (cookie per-host) sehingga /unauthorized berputar tanpa henti. Browser, server, dan NEXTAUTH_URL harus satu host.
const BASE_URL = `http://localhost:${PORT}`;

// Disimpan di node_modules/.cache (git-ignored, tidak disentuh `next build`).
const CACHE_DIR = path.join(__dirname, "node_modules", ".cache", "p4-e2e");

function webServerEnv(): Record<string, string> {
  const testUrl = resolveTestDatabaseUrl(); // melempar bila tidak aman -> Playwright berhenti sebelum server hidup
  return {
    // Playwright's runner sets NODE_ENV=test, and the webServer child inherits it. `next build`/`next start`
    // require "production": with "test" the build uses dev React runtimes and fails to prerender every page.
    // Only the child process gets this; the config process keeps its own NODE_ENV (safeDb rejects "production").
    NODE_ENV: "production",
    DATABASE_URL: testUrl,
    NEXTAUTH_URL: BASE_URL,
    NEXTAUTH_SECRET: randomBytes(32).toString("base64"),
    PORT: String(PORT),
  };
}

export default defineConfig({
  testDir: "./e2e/p4",
  testMatch: "**/*.e2e.ts",
  outputDir: path.join(CACHE_DIR, "results"),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // spec berbagi data seed dan stok; serial menjaga determinisme
  retries: 0,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: path.join(CACHE_DIR, "report") }]],
  globalSetup: enabled ? "./e2e/p4/support/global-setup.ts" : undefined,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: enabled
    ? {
        command: `npm run build && npx next start -H localhost -p ${PORT}`,
        url: `${BASE_URL}/login`,
        reuseExistingServer: false,
        timeout: 600_000,
        stdout: "ignore",
        stderr: "pipe",
        env: webServerEnv(),
      }
    : undefined,
});
