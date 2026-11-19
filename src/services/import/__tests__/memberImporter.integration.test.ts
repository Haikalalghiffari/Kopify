/**
 * Integration test P3: impor anggota ke PostgreSQL Docker lokal (localhost:5433, koperasi_db).
 *
 * Menulis ke database nyata dan TIDAK membersihkan data QA. Hanya jalan jika
 * P3_DB_INTEGRATION=1; tanpa flag, seluruh suite dilewati.
 *
 *   $env:P3_DB_INTEGRATION="1"
 *   npx vitest run src/services/import/__tests__/memberImporter.integration.test.ts
 *
 * Berkas sumber lima anggota: P3_DB_TEST_SOURCE_FILE, default
 * ~/Downloads/Kopify_P3_Contoh_Import_Anggota.xlsx (hanya dibaca).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { suggestColumnMapping, validateColumnMapping } from "@/lib/import/columnMapping";
import { MEMBER_FIELDS } from "@/lib/import/fields";
import { buildImportErrorReportBuffer } from "@/lib/import/errorReport";
import { parseImportLogMetadata } from "@/lib/import/importLogMeta";
import { buildXlsxBufferFromRows, parseImportFile } from "@/lib/import/parseSpreadsheet";
import type {
  ColumnMapping,
  NormalizedMemberRow,
  ValidatedImportRow,
} from "@/lib/import/types";
import { validateImportRows } from "@/lib/import/validateRows";
import { executeImport, getImportLogById } from "@/services/import/importService";
import {
  listImportTemplates,
  saveImportTemplate,
} from "@/services/import/mappingTemplateService";

const ENABLED = process.env.P3_DB_INTEGRATION === "1";
const SOURCE_FILE =
  process.env.P3_DB_TEST_SOURCE_FILE ??
  path.join(os.homedir(), "Downloads", "Kopify_P3_Contoh_Import_Anggota.xlsx");

const EXPECTED_HOST = "localhost";
const EXPECTED_PORT = "5433";
const EXPECTED_DB = "koperasi_db";
const SOURCE_ROW_COUNT = 5;
const QA_MEMBER_NO = "QA-P3-UPD-001";
const QA_TEMPLATE_NAME = "QA-P3-MAP";
const QA_NAME_BEFORE = "QA P3 Nama Awal";
const QA_NAME_AFTER = "QA P3 Nama Diubah";
const TEST_TIMEOUT_MS = 30_000;

const MEMBER_SELECT = {
  memberNo: true,
  name: true,
  nik: true,
  address: true,
  phone: true,
  email: true,
  joinedAt: true,
  status: true,
  deletedAt: true,
  updatedAt: true,
} as const;

interface SourceFile {
  filename: string;
  buffer: Buffer;
  worksheetName: string;
  mapping: ColumnMapping;
  rows: { sourceRowNumber: number; memberNo: string }[];
}

interface Preflight {
  adminId: string;
  source: SourceFile;
  memberCountBefore: number;
}

let pre: Preflight | null = null;
let halted = false;

function loadSource(): { source?: SourceFile; problems: string[] } {
  const problems: string[] = [];
  if (!fs.existsSync(SOURCE_FILE)) {
    return { problems: [`Berkas sumber tidak ditemukan: ${SOURCE_FILE}`] };
  }

  const buffer = fs.readFileSync(SOURCE_FILE);
  const filename = path.basename(SOURCE_FILE);
  const parsed = parseImportFile(buffer, filename);
  const ws = parsed.selectedWorksheet;
  const mapping = suggestColumnMapping(ws.headers, "MEMBERS");

  const mappingCheck = validateColumnMapping(ws.headers, mapping, "MEMBERS");
  if (!mappingCheck.ok) problems.push(...mappingCheck.errors);

  const summary = validateImportRows("MEMBERS", ws, mapping);
  if (summary.totalRows !== SOURCE_ROW_COUNT || summary.validCount !== SOURCE_ROW_COUNT) {
    problems.push(
      `Berkas sumber harus berisi ${SOURCE_ROW_COUNT} baris valid, ditemukan total ${summary.totalRows}, valid ${summary.validCount}.`
    );
  }

  const rows = (summary.rows as ValidatedImportRow<NormalizedMemberRow>[]).flatMap((r) =>
    r.data ? [{ sourceRowNumber: r.sourceRowNumber, memberNo: r.data.memberNo }] : []
  );
  return {
    source: { filename, buffer, worksheetName: ws.name, mapping, rows },
    problems,
  };
}

/** Semua pemeriksaan read-only; dikumpulkan lengkap sebelum satu pun operasi tulis. */
async function runPreflight(): Promise<Preflight> {
  const problems: string[] = [];

  if (process.env.NODE_ENV === "production") {
    problems.push("NODE_ENV=production tidak diizinkan untuk integration test.");
  }

  let dbUrl: URL | null = null;
  try {
    dbUrl = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    problems.push("DATABASE_URL tidak ada atau tidak valid.");
  }
  if (dbUrl) {
    const dbName = dbUrl.pathname.replace(/^\//, "");
    if (dbUrl.hostname !== EXPECTED_HOST) {
      problems.push(`Host database "${dbUrl.hostname}" bukan ${EXPECTED_HOST}.`);
    }
    if (dbUrl.port !== EXPECTED_PORT) {
      problems.push(`Port database "${dbUrl.port}" bukan ${EXPECTED_PORT}.`);
    }
    if (dbName !== EXPECTED_DB) {
      problems.push(`Nama database "${dbName}" bukan ${EXPECTED_DB}.`);
    }
  }

  const { source, problems: sourceProblems } = loadSource();
  problems.push(...sourceProblems);

  // Koneksi hanya dicoba jika alamat lolos, agar tidak menyentuh DB lain.
  if (problems.length > 0) {
    throw new Error(`Pemeriksaan awal gagal, tidak ada data ditulis:\n- ${problems.join("\n- ")}`);
  }

  const [{ name: serverDb }] = await db.$queryRaw<
    { name: string }[]
  >`SELECT current_database()::text AS name`;
  if (serverDb !== EXPECTED_DB) {
    problems.push(`current_database() = "${serverDb}", bukan ${EXPECTED_DB}.`);
  }

  const admin = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  if (!admin) problems.push("Tidak ada user ADMIN aktif untuk menjadi pelaku impor.");

  const sourceNos = source!.rows.map((r) => r.memberNo);
  const existing = await db.member.findMany({
    where: { memberNo: { in: sourceNos } },
    select: { memberNo: true, deletedAt: true },
  });
  const activeNos = new Set(existing.filter((m) => !m.deletedAt).map((m) => m.memberNo));
  const missing = sourceNos.filter((no) => !activeNos.has(no));
  if (missing.length > 0) {
    problems.push(
      `Nomor anggota sumber belum ada (atau soft-deleted) di database: ${missing.join(", ")}.`
    );
  }

  if ((await db.member.count({ where: { memberNo: QA_MEMBER_NO } })) > 0) {
    problems.push(`Anggota ${QA_MEMBER_NO} sudah ada.`);
  }
  if ((await db.importTemplate.count({ where: { name: QA_TEMPLATE_NAME } })) > 0) {
    problems.push(`Template ${QA_TEMPLATE_NAME} sudah ada.`);
  }

  if (problems.length > 0) {
    throw new Error(`Pemeriksaan awal gagal, tidak ada data ditulis:\n- ${problems.join("\n- ")}`);
  }

  return {
    adminId: admin!.id,
    source: source!,
    memberCountBefore: await db.member.count(),
  };
}

function requirePreflight(): Preflight {
  if (!pre) throw new Error("Pemeriksaan awal belum lolos; pengujian tulis dibatalkan.");
  if (halted) throw new Error("Pengujian sebelumnya gagal; sisa pengujian tulis dibatalkan.");
  return pre;
}

function snapshotMembers() {
  return db.member.findMany({ orderBy: { memberNo: "asc" }, select: MEMBER_SELECT });
}

function qaWorkbook(name: string) {
  const values: Record<string, string> = {
    memberNo: QA_MEMBER_NO,
    name,
    nik: "",
    address: "Jl. QA Uji Impor No. 1",
    phone: "081200000001",
    email: "qa-p3-upd-001@example.test",
    joinedAt: "2026-11-01",
    status: "AKTIF",
  };
  const headers = MEMBER_FIELDS.map((f) => f.label);
  const buffer = buildXlsxBufferFromRows("Anggota", headers, [
    MEMBER_FIELDS.map((f) => values[f.key] ?? ""),
  ]);
  return { buffer, headers, mapping: suggestColumnMapping(headers, "MEMBERS") };
}

describe.skipIf(!ENABLED)("integrasi impor anggota (PostgreSQL lokal)", () => {
  beforeAll(async () => {
    pre = await runPreflight();
  }, TEST_TIMEOUT_MS);

  afterEach(({ task }) => {
    if (task.result?.state === "fail") halted = true;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("T1 SKIP: lima anggota lama dilewati tanpa mengubah data", async () => {
    const { adminId, source, memberCountBefore } = requirePreflight();
    const membersBefore = await snapshotMembers();
    const logsBefore = await db.importLog.count();

    const result = await executeImport({
      userId: adminId,
      importType: "MEMBERS",
      filename: source.filename,
      buffer: source.buffer,
      mapping: source.mapping,
      duplicateMode: "SKIP",
      worksheetName: source.worksheetName,
    });

    expect(result).toMatchObject({
      totalRows: SOURCE_ROW_COUNT,
      successRows: 0,
      skippedRows: SOURCE_ROW_COUNT,
      failedRows: 0,
    });

    const log = await getImportLogById(result.importLogId);
    const meta = parseImportLogMetadata(log?.mappingJson);
    expect(log).toMatchObject({
      type: "MEMBERS",
      filename: source.filename,
      createdBy: adminId,
      totalRows: SOURCE_ROW_COUNT,
      successRows: 0,
      failedRows: 0,
      status: result.status,
    });
    expect(meta?.skippedRows).toBe(SOURCE_ROW_COUNT);
    expect(meta?.duplicateMode).toBe("SKIP");

    expect(await db.importLog.count()).toBe(logsBefore + 1);
    expect(await db.member.count()).toBe(memberCountBefore);
    expect(await snapshotMembers()).toEqual(membersBefore);
  }, TEST_TIMEOUT_MS);

  it("T2 ERROR: lima duplikat ditandai gagal dan laporan error terbaca", async () => {
    const { adminId, source, memberCountBefore } = requirePreflight();
    const membersBefore = await snapshotMembers();

    const result = await executeImport({
      userId: adminId,
      importType: "MEMBERS",
      filename: source.filename,
      buffer: source.buffer,
      mapping: source.mapping,
      duplicateMode: "ERROR",
      worksheetName: source.worksheetName,
    });

    expect(result).toMatchObject({
      totalRows: SOURCE_ROW_COUNT,
      successRows: 0,
      skippedRows: 0,
      failedRows: SOURCE_ROW_COUNT,
      status: "FAILED",
    });

    const log = await getImportLogById(result.importLogId);
    const meta = parseImportLogMetadata(log?.mappingJson);
    expect(meta?.duplicateMode).toBe("ERROR");
    expect(meta?.errors).toHaveLength(SOURCE_ROW_COUNT);
    expect(meta?.errors.map((e) => e.sourceRowNumber).sort()).toEqual(
      source.rows.map((r) => r.sourceRowNumber).sort()
    );
    for (const err of meta?.errors ?? []) {
      expect(err.field).toBe("memberNo");
      expect(err.message).toContain("sudah ada");
    }

    const workbook = XLSX.read(buildImportErrorReportBuffer(meta?.errors ?? [], log!.filename), {
      type: "buffer",
    });
    const reportRows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets[workbook.SheetNames[0]]
    );
    expect(reportRows).toHaveLength(SOURCE_ROW_COUNT);
    expect(reportRows.map((r) => Number(r["Nomor Baris"])).sort()).toEqual(
      source.rows.map((r) => r.sourceRowNumber).sort()
    );

    expect(await db.member.count()).toBe(memberCountBefore);
    expect(await snapshotMembers()).toEqual(membersBefore);
  }, TEST_TIMEOUT_MS);

  it("T3 UPDATE: hanya nama QA-P3-UPD-001 yang berubah", async () => {
    const { adminId } = requirePreflight();
    const base = {
      userId: adminId,
      importType: "MEMBERS" as const,
      worksheetName: "Anggota",
    };

    const created = qaWorkbook(QA_NAME_BEFORE);
    const createResult = await executeImport({
      ...base,
      filename: "QA-P3-create.xlsx",
      buffer: created.buffer,
      mapping: created.mapping,
      duplicateMode: "SKIP",
    });
    expect(createResult).toMatchObject({ successRows: 1, failedRows: 0, skippedRows: 0 });

    const qaBefore = await db.member.findUniqueOrThrow({
      where: { memberNo: QA_MEMBER_NO },
      select: MEMBER_SELECT,
    });
    expect(qaBefore.name).toBe(QA_NAME_BEFORE);
    const othersBefore = (await snapshotMembers()).filter((m) => m.memberNo !== QA_MEMBER_NO);

    const updated = qaWorkbook(QA_NAME_AFTER);
    const updateResult = await executeImport({
      ...base,
      filename: "QA-P3-update.xlsx",
      buffer: updated.buffer,
      mapping: updated.mapping,
      duplicateMode: "UPDATE",
    });
    expect(updateResult).toMatchObject({ successRows: 1, failedRows: 0, skippedRows: 0 });

    expect(await db.member.count({ where: { memberNo: QA_MEMBER_NO } })).toBe(1);
    const qaAfter = await db.member.findUniqueOrThrow({
      where: { memberNo: QA_MEMBER_NO },
      select: MEMBER_SELECT,
    });
    expect(qaAfter.name).toBe(QA_NAME_AFTER);
    const { name: _nameBefore, updatedAt: _updatedBefore, ...restBefore } = qaBefore;
    const { name: _nameAfter, updatedAt: _updatedAfter, ...restAfter } = qaAfter;
    expect(restAfter).toEqual(restBefore);

    const othersAfter = (await snapshotMembers()).filter((m) => m.memberNo !== QA_MEMBER_NO);
    expect(othersAfter).toEqual(othersBefore);
  }, TEST_TIMEOUT_MS);

  it("T4 template: QA-P3-MAP tersimpan, termuat, dan mapping tetap valid", async () => {
    const { adminId } = requirePreflight();
    const qa = qaWorkbook(QA_NAME_BEFORE);

    const saved = await saveImportTemplate({
      type: "MEMBERS",
      name: QA_TEMPLATE_NAME,
      mapping: qa.mapping,
      userId: adminId,
    });

    const loaded = (await listImportTemplates("MEMBERS", adminId)).find((t) => t.id === saved.id);
    expect(loaded?.name).toBe(QA_TEMPLATE_NAME);
    expect(loaded?.mappingJson).toEqual(qa.mapping);

    const row = await db.importTemplate.findUniqueOrThrow({ where: { id: saved.id } });
    expect(row).toMatchObject({ type: "MEMBERS", name: QA_TEMPLATE_NAME, createdBy: adminId });
    expect(row.mappingJson).toEqual(qa.mapping);

    const loadedMapping = loaded!.mappingJson as ColumnMapping;
    expect(validateColumnMapping(qa.headers, loadedMapping, "MEMBERS").ok).toBe(true);
    const reused = validateImportRows(
      "MEMBERS",
      parseImportFile(qa.buffer, "QA-P3-create.xlsx").selectedWorksheet,
      loadedMapping
    );
    expect(reused).toMatchObject({ totalRows: 1, validCount: 1, invalidCount: 0 });
  }, TEST_TIMEOUT_MS);
});
