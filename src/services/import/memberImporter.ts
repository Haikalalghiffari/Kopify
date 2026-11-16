import { MemberStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { validateColumnMapping } from "@/lib/import/columnMapping";
import { parseImportFile } from "@/lib/import/parseSpreadsheet";
import type {
  ColumnMapping,
  DuplicateHandlingMode,
  NormalizedMemberRow,
  ValidatedImportRow,
} from "@/lib/import/types";
import { validateImportRows } from "@/lib/import/validateRows";
import {
  MEMBER_IMPORT_BATCH_SIZE,
  type MemberImportInput,
  type MemberImportResult,
  type MemberRowImportResult,
} from "./types";

type ExistingMember = {
  id: string;
  memberNo: string;
  deletedAt: Date | null;
};

function memberCreateData(row: NormalizedMemberRow) {
  return {
    memberNo: row.memberNo,
    name: row.name,
    nik: row.nik,
    address: row.address,
    phone: row.phone,
    email: row.email,
    joinedAt: row.joinedAt ?? new Date(),
    status: row.status as MemberStatus,
  };
}

/**
 * Hanya field yang dipetakan dan sel sumbernya terisi yang ikut UPDATE.
 * CREATE memakai memberCreateData; tidak memakai updateProvidedFields.
 */
export function buildMemberUpdateData(
  row: NormalizedMemberRow
): Prisma.MemberUpdateInput {
  const provided = new Set(row.updateProvidedFields ?? []);
  const data: Prisma.MemberUpdateInput = { name: row.name };

  if (provided.has("nik")) data.nik = row.nik;
  if (provided.has("address")) data.address = row.address;
  if (provided.has("phone")) data.phone = row.phone;
  if (provided.has("email")) data.email = row.email;
  if (provided.has("joinedAt") && row.joinedAt) {
    data.joinedAt = row.joinedAt;
  }
  if (provided.has("status")) {
    data.status = row.status as MemberStatus;
  }

  return data;
}

async function loadExistingByMemberNos(
  memberNos: string[],
  client: Prisma.TransactionClient | typeof db
): Promise<Map<string, ExistingMember>> {
  if (memberNos.length === 0) return new Map();
  const rows = await client.member.findMany({
    where: { memberNo: { in: memberNos } },
    select: { id: true, memberNo: true, deletedAt: true },
  });
  return new Map(rows.map((r) => [r.memberNo, r]));
}

function handleExistingMember(
  duplicateMode: DuplicateHandlingMode,
  existing: ExistingMember
): { kind: "skip" } | { kind: "fail"; message: string } | { kind: "update"; id: string } | { kind: "error_duplicate" } {
  if (existing.deletedAt) {
    return {
      kind: "fail",
      message:
        "Anggota dengan nomor ini pernah dihapus (soft delete). Pulihkan lewat Master Data sebelum impor.",
    };
  }

  switch (duplicateMode) {
    case "SKIP":
      return { kind: "skip" };
    case "UPDATE":
      return { kind: "update", id: existing.id };
    case "ERROR":
      return { kind: "error_duplicate" };
    default:
      return { kind: "error_duplicate" };
  }
}

function prismaErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(", ")
        : "unik";
      return `Pelanggaran data unik (${target}).`;
    }
  }
  return "Gagal menyimpan ke database.";
}

async function processBatch(
  batch: ValidatedImportRow<NormalizedMemberRow>[],
  duplicateMode: DuplicateHandlingMode,
  client: Prisma.TransactionClient
): Promise<MemberRowImportResult[]> {
  const nos = batch
    .map((b) => b.data?.memberNo)
    .filter((n): n is string => Boolean(n));
  const existingMap = await loadExistingByMemberNos(nos, client);
  const results: MemberRowImportResult[] = [];

  for (const row of batch) {
    if (!row.data) continue;
    const data = row.data;
    const existing = existingMap.get(data.memberNo);

    try {
      if (existing) {
        const decision = handleExistingMember(duplicateMode, existing);
        if (decision.kind === "skip") {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "skipped",
            errors: [],
          });
          continue;
        }
        if (decision.kind === "fail") {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "failed",
            errors: [{ field: "memberNo", message: decision.message }],
          });
          continue;
        }
        if (decision.kind === "error_duplicate") {
          results.push({
            sourceRowNumber: row.sourceRowNumber,
            outcome: "failed",
            errors: [
              {
                field: "memberNo",
                message: "Nomor anggota sudah ada di database (mode error).",
              },
            ],
          });
          continue;
        }
        await client.member.update({
          where: { id: decision.id },
          data: buildMemberUpdateData(data),
        });
        results.push({
          sourceRowNumber: row.sourceRowNumber,
          outcome: "updated",
          errors: [],
        });
        continue;
      }

      await client.member.create({ data: memberCreateData(data) });
      existingMap.set(data.memberNo, {
        id: "new",
        memberNo: data.memberNo,
        deletedAt: null,
      });
      results.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "created",
        errors: [],
      });
    } catch (err) {
      results.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "failed",
        errors: [{ field: "memberNo", message: prismaErrorMessage(err) }],
      });
    }
  }

  return results;
}

export async function importMembersFromFile(
  input: MemberImportInput
): Promise<MemberImportResult> {
  const parsed = parseImportFile(input.buffer, input.filename, {
    worksheetName: input.worksheetName,
  });

  const headers = parsed.selectedWorksheet.headers;
  const mappingCheck = validateColumnMapping(
    headers,
    input.mapping,
    "MEMBERS"
  );
  if (!mappingCheck.ok) {
    throw new Error(mappingCheck.errors.join(" "));
  }

  const validation = validateImportRows(
    "MEMBERS",
    parsed.selectedWorksheet,
    input.mapping,
    { strict: input.strict, duplicateHandling: input.duplicateMode }
  );

  const rowResults: MemberRowImportResult[] = [];

  for (const row of validation.rows) {
    if (row.data === null || row.errors.length > 0) {
      rowResults.push({
        sourceRowNumber: row.sourceRowNumber,
        outcome: "failed",
        errors: row.errors.length
          ? row.errors
          : [{ field: "_row", message: "Baris tidak valid." }],
      });
    }
  }

  const validRows = validation.rows.filter(
    (r) => r.data !== null && r.errors.length === 0
  ) as ValidatedImportRow<NormalizedMemberRow>[];

  for (let i = 0; i < validRows.length; i += MEMBER_IMPORT_BATCH_SIZE) {
    const slice = validRows.slice(i, i + MEMBER_IMPORT_BATCH_SIZE);
    try {
      const batchResults = await db.$transaction(async (tx) =>
        processBatch(slice, input.duplicateMode, tx)
      );
      rowResults.push(...batchResults);
    } catch {
      for (const row of slice) {
        rowResults.push({
          sourceRowNumber: row.sourceRowNumber,
          outcome: "failed",
          errors: [
            {
              field: "_batch",
              message:
                "Batch gagal dan di-rollback. Coba impor ulang baris ini.",
            },
          ],
        });
      }
    }
  }

  let successRows = 0;
  let skippedRows = 0;
  let failedRows = 0;

  for (const r of rowResults) {
    if (r.outcome === "created" || r.outcome === "updated") successRows++;
    else if (r.outcome === "skipped") skippedRows++;
    else failedRows++;
  }

  return {
    totalRows: validation.totalRows,
    validationFailedCount: validation.invalidCount,
    successRows,
    failedRows,
    skippedRows,
    rowResults,
  };
}