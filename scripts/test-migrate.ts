import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// 1. Helper untuk membaca file .env secara aman tanpa dependensi eksternal
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Prioritaskan environment yang sudah ada di process.env
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

// Muat variabel dari .env jika belum diset di environment
const rootDir = process.cwd();
loadEnvFile(path.join(rootDir, ".env.test"));
loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

// 2. Baca TEST_DATABASE_URL
const testDbUrl = process.env.TEST_DATABASE_URL;

if (!testDbUrl) {
  console.error(
    "❌ ERROR: TEST_DATABASE_URL tidak ditemukan di environment maupun file .env."
  );
  console.error(
    'Contoh: TEST_DATABASE_URL="postgresql://koperasi_user:koperasi_pass@localhost:5433/koperasi_test_db?schema=public"'
  );
  process.exit(1);
}

// 3. Validasi ketat nama database harus tepat 'koperasi_test_db'
let parsedUrl: URL;
try {
  parsedUrl = new URL(testDbUrl);
} catch {
  console.error(`❌ ERROR: Format TEST_DATABASE_URL tidak valid: "${testDbUrl}"`);
  process.exit(1);
}

const dbName = parsedUrl.pathname.replace(/^\//, "").split("?")[0].toLowerCase();

if (dbName !== "koperasi_test_db") {
  console.error(
    `❌ SAFETY CHECK GAGAL: test:migrate HANYA diizinkan berjalan pada database "koperasi_test_db".`
  );
  console.error(`Database yang terdeteksi: "${dbName}".`);
  console.error(
    `Operasi migration dibatalkan untuk mencegah perubahan skema atau data pada database lain (seperti koperasi_db).`
  );
  process.exit(1);
}

console.log(`🔒 Safety Guard passed: Menjalankan migration pada database pengujian "${dbName}"...`);

// 4. Jalankan 'prisma migrate deploy' dengan DATABASE_URL sementara diarahkan ke TEST_DATABASE_URL
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: testDbUrl,
  },
});

if (result.error) {
  console.error("❌ Gagal mengeksekusi prisma migrate deploy:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("✅ Migration database pengujian berhasil diselesaikan.");
