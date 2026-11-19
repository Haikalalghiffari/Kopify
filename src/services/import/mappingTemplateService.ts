import { db } from "@/lib/db";
import type { ColumnMapping, ImportDataType } from "@/lib/import/types";

export async function listImportTemplates(
  type: ImportDataType,
  userId: string
) {
  return db.importTemplate.findMany({
    where: { type, createdBy: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      mappingJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function saveImportTemplate(params: {
  type: ImportDataType;
  name: string;
  mapping: ColumnMapping;
  userId: string;
}) {
  const name = params.name.trim();
  if (!name) {
    throw new Error("Nama template wajib diisi.");
  }

  return db.importTemplate.create({
    data: {
      type: params.type,
      name,
      mappingJson: params.mapping,
      createdBy: params.userId,
    },
  });
}

export async function deleteImportTemplate(id: string, userId: string) {
  const existing = await db.importTemplate.findFirst({
    where: { id, createdBy: userId },
  });
  if (!existing) {
    throw new Error("Template tidak ditemukan.");
  }
  await db.importTemplate.delete({ where: { id } });
}