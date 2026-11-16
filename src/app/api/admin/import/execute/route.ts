import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { executeImport } from "@/services/import/importService";
import { isProductImportExecutionAllowed } from "@/services/import/stockGateway";
import { parseImportType } from "@/lib/import/sessionPayload";
import type { ColumnMapping, DuplicateHandlingMode } from "@/lib/import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMapping(raw: FormDataEntryValue | null): ColumnMapping | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as ColumnMapping;
  } catch {
    return null;
  }
}

function parseDuplicateMode(
  raw: FormDataEntryValue | null
): DuplicateHandlingMode {
  if (raw === "UPDATE" || raw === "ERROR") return raw;
  return "SKIP";
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    const user = await requireRole(Role.ADMIN);
    userId = user.id;
  } catch {
    return NextResponse.json(
      { success: false, error: "Akses ditolak. Hanya admin yang dapat mengimpor data." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const importType = parseImportType(formData.get("importType"));
  if (!importType) {
    return NextResponse.json(
      { success: false, error: "Jenis impor tidak valid." },
      { status: 400 }
    );
  }

  if (importType === "PRODUCTS") {
    const gate = await isProductImportExecutionAllowed();
    return NextResponse.json(
      {
        success: false,
        error:
          gate.reason ??
          "Impor barang belum tersedia sampai stockService P2 siap.",
      },
      { status: 503 }
    );
  }

  const mapping = parseMapping(formData.get("mapping"));
  if (!mapping) {
    return NextResponse.json(
      { success: false, error: "Pemetaan kolom tidak valid." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "File belum dipilih." },
      { status: 400 }
    );
  }

  const worksheetName = formData.get("worksheetName");
  const strict = formData.get("strict") === "true";
  const duplicateMode = parseDuplicateMode(formData.get("duplicateMode"));
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await executeImport({
      userId,
      importType,
      filename: file.name,
      buffer,
      mapping,
      duplicateMode,
      strict,
      worksheetName:
        typeof worksheetName === "string" && worksheetName.trim()
          ? worksheetName.trim()
          : undefined,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menjalankan impor.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}