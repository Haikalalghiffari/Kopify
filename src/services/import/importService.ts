import { ImportStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ImportDataType, DuplicateHandlingMode, ColumnMapping } from "@/lib/import/types";
import {
  type ImportLogMetadata,
  IMPORT_LOG_META_VERSION,
  toStoredErrors,
} from "@/lib/import/importLogMeta";
import { importMembersFromFile } from "./memberImporter";
import { importProductsFromFile } from "./productImporter";
import {
  MEMBER_IMPORT_BATCH_SIZE,
  PRODUCT_IMPORT_BATCH_SIZE,
  type MemberImportInput,
  type ProductImportInput,
} from "./types";
import { isProductImportExecutionAllowed } from "./stockGateway";

export interface ExecuteImportInput {
  userId: string;
  importType: ImportDataType;
  filename: string;
  buffer: Buffer;
  mapping: ColumnMapping;
  duplicateMode: DuplicateHandlingMode;
  strict?: boolean;
  worksheetName?: string;
}

export interface ExecuteImportResult {
  importLogId: string;
  status: ImportStatus;
  totalRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
}

/**
 * SUCCESS hanya jika tidak ada baris gagal dan setiap baris tercatat berhasil atau dilewati.
 * Jumlah yang tidak konsisten dengan total tidak boleh dianggap SUCCESS.
 */
export function resolveImportStatus(counts: {
  totalRows: number;
  successRows: number;
  skippedRows: number;
  failedRows: number;
}): ImportStatus {
  const { totalRows, successRows, skippedRows, failedRows } = counts;
  if (failedRows > 0) {
    return successRows > 0 ? ImportStatus.PARTIAL : ImportStatus.FAILED;
  }
  if (totalRows <= 0) return ImportStatus.FAILED;
  return successRows + skippedRows === totalRows
    ? ImportStatus.SUCCESS
    : ImportStatus.PARTIAL;
}

export async function executeImport(
  input: ExecuteImportInput
): Promise<ExecuteImportResult> {
  if (input.importType === "PRODUCTS") {
    const gate = await isProductImportExecutionAllowed();
    if (!gate.allowed) {
      throw new Error(gate.reason ?? "Impor barang belum tersedia.");
    }

    const pending = await db.importLog.create({
      data: {
        type: input.importType,
        filename: input.filename,
        status: ImportStatus.PENDING,
        createdBy: input.userId,
        totalRows: 0,
        successRows: 0,
        failedRows: 0,
      },
    });

    const productInput: ProductImportInput = {
      userId: input.userId,
      importLogId: pending.id,
      filename: input.filename,
      buffer: input.buffer,
      mapping: input.mapping,
      duplicateMode: input.duplicateMode,
      strict: input.strict,
      worksheetName: input.worksheetName,
    };

    try {
      const result = await importProductsFromFile(productInput);

      const failedForStore = result.rowResults.filter(
        (r) => r.outcome === "failed"
      );

      const metadata: ImportLogMetadata = {
        version: IMPORT_LOG_META_VERSION,
        mapping: input.mapping,
        duplicateMode: input.duplicateMode,
        strict: Boolean(input.strict),
        worksheetName: input.worksheetName,
        skippedRows: result.skippedRows,
        errors: toStoredErrors(failedForStore),
        batchSize: PRODUCT_IMPORT_BATCH_SIZE,
      };

      const status = resolveImportStatus(result);

      const updated = await db.importLog.update({
        where: { id: pending.id },
        data: {
          totalRows: result.totalRows,
          successRows: result.successRows,
          failedRows: result.failedRows,
          status,
          mappingJson: metadata as unknown as Prisma.InputJsonValue,
        },
      });

      try {
        await db.auditLog.create({
          data: {
            userId: input.userId,
            action: "IMPORT_EXECUTE",
            entity: "ImportLog",
            entityId: updated.id,
            detailJson: {
              type: input.importType,
              filename: input.filename,
              successRows: result.successRows,
              failedRows: result.failedRows,
              skippedRows: result.skippedRows,
              status,
            },
          },
        });
      } catch (err) {
        console.error("Gagal mencatat audit impor:", err);
      }

      return {
        importLogId: updated.id,
        status: updated.status,
        totalRows: updated.totalRows,
        successRows: updated.successRows,
        failedRows: updated.failedRows,
        skippedRows: result.skippedRows,
      };
    } catch (err) {
      await db.importLog.update({
        where: { id: pending.id },
        data: {
          status: ImportStatus.FAILED,
          mappingJson: {
            version: IMPORT_LOG_META_VERSION,
            mapping: input.mapping,
            duplicateMode: input.duplicateMode,
            strict: Boolean(input.strict),
            skippedRows: 0,
            errors: [],
            batchSize: PRODUCT_IMPORT_BATCH_SIZE,
            fatalError:
              err instanceof Error ? err.message : "Impor gagal secara fatal.",
          } as unknown as Prisma.InputJsonValue,
        },
      });
      throw err;
    }
  }

  const pending = await db.importLog.create({
    data: {
      type: input.importType,
      filename: input.filename,
      status: ImportStatus.PENDING,
      createdBy: input.userId,
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
    },
  });

  const memberInput: MemberImportInput = {
    userId: input.userId,
    filename: input.filename,
    buffer: input.buffer,
    mapping: input.mapping,
    duplicateMode: input.duplicateMode,
    strict: input.strict,
    worksheetName: input.worksheetName,
  };

  try {
    const result = await importMembersFromFile(memberInput);

    const failedForStore = result.rowResults.filter(
      (r) => r.outcome === "failed"
    );

    const metadata: ImportLogMetadata = {
      version: IMPORT_LOG_META_VERSION,
      mapping: input.mapping,
      duplicateMode: input.duplicateMode,
      strict: Boolean(input.strict),
      worksheetName: input.worksheetName,
      skippedRows: result.skippedRows,
      errors: toStoredErrors(failedForStore),
      batchSize: MEMBER_IMPORT_BATCH_SIZE,
    };

    const status = resolveImportStatus(result);

    const updated = await db.importLog.update({
      where: { id: pending.id },
      data: {
        totalRows: result.totalRows,
        successRows: result.successRows,
        failedRows: result.failedRows,
        status,
        mappingJson: metadata as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          userId: input.userId,
          action: "IMPORT_EXECUTE",
          entity: "ImportLog",
          entityId: updated.id,
          detailJson: {
            type: input.importType,
            filename: input.filename,
            successRows: result.successRows,
            failedRows: result.failedRows,
            skippedRows: result.skippedRows,
            status,
          },
        },
      });
    } catch (err) {
      console.error("Gagal mencatat audit impor:", err);
    }

    return {
      importLogId: updated.id,
      status: updated.status,
      totalRows: updated.totalRows,
      successRows: updated.successRows,
      failedRows: updated.failedRows,
      skippedRows: result.skippedRows,
    };
  } catch (err) {
    await db.importLog.update({
      where: { id: pending.id },
      data: {
        status: ImportStatus.FAILED,
        mappingJson: {
          version: IMPORT_LOG_META_VERSION,
          mapping: input.mapping,
          duplicateMode: input.duplicateMode,
          strict: Boolean(input.strict),
          skippedRows: 0,
          errors: [],
          batchSize: MEMBER_IMPORT_BATCH_SIZE,
          fatalError:
            err instanceof Error ? err.message : "Impor gagal secara fatal.",
        } as unknown as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}

export async function listImportHistory(limit = 50) {
  return db.importLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: { username: true, email: true },
      },
    },
  });
}

export async function getImportLogById(id: string) {
  return db.importLog.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, email: true } },
    },
  });
}