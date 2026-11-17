"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  parseUploadedFile,
  autoSuggestMappings,
  validateImportRows,
  executeBatchImport,
  DuplicateMode,
} from "@/services/importService";

export async function uploadAndAnalyzeFile(formData: FormData) {
  const session = await auth();
  if (!session || (session.user as any).role === "ANGGOTA") {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File;
  const type = formData.get("type") as "ANGGOTA" | "BARANG";

  if (!file) throw new Error("File belum dipilih");

  // Max 10MB check
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Ukuran file melebihi batas maksimal 10 MB");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const parsed = await parseUploadedFile(buffer, file.name);
  const suggestedMappings = autoSuggestMappings(parsed.headers, type);

  return {
    filename: file.name,
    headers: parsed.headers,
    totalRows: parsed.totalRows,
    sampleRows: parsed.sampleRows,
    allRows: parsed.allRows,
    suggestedMappings,
  };
}

export async function validateRowsAction({
  rows,
  mappings,
  type,
}: {
  rows: Record<string, any>[];
  mappings: Record<string, string>;
  type: "ANGGOTA" | "BARANG";
}) {
  const session = await auth();
  if (!session || (session.user as any).role === "ANGGOTA") {
    throw new Error("Unauthorized");
  }

  return validateImportRows(rows, mappings, type);
}

export async function executeImportAction({
  rows,
  mappings,
  type,
  duplicateMode,
  filename,
}: {
  rows: Record<string, any>[];
  mappings: Record<string, string>;
  type: "ANGGOTA" | "BARANG";
  duplicateMode: DuplicateMode;
  filename: string;
}) {
  const session = await auth();
  if (!session || (session.user as any).role === "ANGGOTA") {
    throw new Error("Unauthorized");
  }
  const userId = (session.user as any).id;

  const result = await executeBatchImport({
    rows,
    mappings,
    type,
    duplicateMode,
    userId,
    filename,
  });

  revalidatePath("/admin/members");
  revalidatePath("/admin/products");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/import");
  return result;
}

export async function getImportHistory() {
  const session = await auth();
  if (!session || (session.user as any).role === "ANGGOTA") {
    throw new Error("Unauthorized");
  }

  return await db.importLog.findMany({
    include: {
      createdBy: { select: { username: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function saveImportTemplate({
  name,
  type,
  mapping,
}: {
  name: string;
  type: "ANGGOTA" | "BARANG";
  mapping: Record<string, string>;
}) {
  const session = await auth();
  if (!session || (session.user as any).role === "ANGGOTA") {
    throw new Error("Unauthorized");
  }
  const userId = (session.user as any).id;

  return await db.importTemplate.create({
    data: {
      name,
      type,
      mappingJson: mapping,
      createdById: userId,
    },
  });
}

export async function getSavedTemplates(type: "ANGGOTA" | "BARANG") {
  const session = await auth();
  if (!session || (session.user as any).role === "ANGGOTA") {
    throw new Error("Unauthorized");
  }

  return await db.importTemplate.findMany({
    where: { type },
    orderBy: { createdAt: "desc" },
  });
}
