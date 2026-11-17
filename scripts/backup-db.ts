#!/usr/bin/env tsx
/**
 * scripts/backup-db.ts
 * Skrip backup database PostgreSQL otomatis.
 *
 * Cara pakai:
 *   npx tsx scripts/backup-db.ts
 *
 * Atau via npm script (package.json):
 *   "db:backup": "tsx scripts/backup-db.ts"
 *
 * Backup disimpan di folder ./backups/
 * Format file: backup_koperasi_YYYY-MM-DD_HH-MM-SS.sql.gz
 * Retensi otomatis: file lebih lama dari 30 hari dihapus.
 */

import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Config ─────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || "";
const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const RETENTION_DAYS = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseDbUrl(url: string) {
  // postgresql://user:password@host:port/dbname
  const match = url.match(
    /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
  );
  if (!match) throw new Error("DATABASE_URL format tidak valid.");
  return { user: match[1], password: match[2], host: match[3], port: match[4], dbname: match[5] };
}

function timestamp() {
  const now = new Date();
  return now
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .replace(/\..+/, "");
}

function cleanOldBackups(dir: string, retentionDays: number) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql.gz") || f.endsWith(".sql"));
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
      deleted++;
      console.log(`  🗑  Deleted old backup: ${file}`);
    }
  }
  return deleted;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL tidak ditemukan di environment. Set DATABASE_URL terlebih dahulu.");
    process.exit(1);
  }

  // Pastikan folder backups ada
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Folder backups dibuat: ${BACKUP_DIR}`);
  }

  let dbInfo: ReturnType<typeof parseDbUrl>;
  try {
    dbInfo = parseDbUrl(DATABASE_URL);
  } catch (e: any) {
    console.error("❌", e.message);
    process.exit(1);
  }

  const ts = timestamp();
  const filename = `backup_koperasi_${ts}.sql`;
  const filenameGz = `${filename}.gz`;
  const outPath = path.join(BACKUP_DIR, filename);
  const outPathGz = path.join(BACKUP_DIR, filenameGz);

  console.log(`\n🗄  Sistem Informasi Koperasi — Database Backup`);
  console.log(`   Database : ${dbInfo.dbname} @ ${dbInfo.host}:${dbInfo.port}`);
  console.log(`   Output   : ${filenameGz}`);
  console.log(`   Waktu    : ${new Date().toLocaleString("id-ID")}\n`);

  // Cek pg_dump tersedia
  try {
    execSync("pg_dump --version", { stdio: "ignore" });
  } catch {
    console.error("❌ pg_dump tidak ditemukan. Pastikan PostgreSQL client tools terinstall.");
    console.error("   Windows: https://www.postgresql.org/download/windows/");
    process.exit(1);
  }

  // Jalankan pg_dump
  const env = { ...process.env, PGPASSWORD: dbInfo.password };
  const dumpArgs = [
    "-h", dbInfo.host,
    "-p", dbInfo.port,
    "-U", dbInfo.user,
    "-d", dbInfo.dbname,
    "--no-password",
    "--format=plain",
    "--encoding=UTF8",
    `--file=${outPath}`,
  ];

  console.log("⏳ Menjalankan pg_dump...");
  const result = spawnSync("pg_dump", dumpArgs, { env, stdio: ["ignore", "inherit", "inherit"] });

  if (result.status !== 0) {
    console.error("❌ pg_dump gagal. Periksa koneksi dan kredensial database.");
    process.exit(1);
  }

  // Kompres dengan gzip jika tersedia
  try {
    execSync(`gzip -f "${outPath}"`, { stdio: "ignore" });
    const stat = fs.statSync(outPathGz);
    const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Backup berhasil: ${filenameGz} (${sizeMb} MB)`);
  } catch {
    // gzip tidak tersedia (Windows tanpa tools) — simpan .sql saja
    const stat = fs.statSync(outPath);
    const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Backup berhasil: ${filename} (${sizeMb} MB) — gzip tidak tersedia, file tidak dikompresi.`);
  }

  // Bersihkan backup lama
  console.log(`\n🧹 Membersihkan backup lebih lama dari ${RETENTION_DAYS} hari...`);
  const deleted = cleanOldBackups(BACKUP_DIR, RETENTION_DAYS);
  if (deleted === 0) console.log("   Tidak ada backup lama yang perlu dihapus.");

  console.log("\n✨ Selesai.\n");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
