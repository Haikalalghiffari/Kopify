import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { validateColumnMapping } from "@/lib/import/columnMapping";
import { parseImportFile } from "@/lib/import/parseSpreadsheet";
import {
  parseImportType,
  toPreviewPayload,
  type PreviewImportApiResponse,
} from "@/lib/import/sessionPayload";
import { loadCategoryUnitMaps, applyProductMasterValidation } from "@/lib/import/productMasterRefs";
import { validateImportRows } from "@/lib/import/validateRows";
import type { ColumnMapping, ImportValidationOptions } from "@/lib/import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMappingJson(raw: FormDataEntryValue | null): ColumnMapping | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as ColumnMapping;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);
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

  const mapping = parseMappingJson(formData.get("mapping"));
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
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const parsed = parseImportFile(buffer, file.name, {
      worksheetName:
        typeof worksheetName === "string" && worksheetName.trim()
          ? worksheetName.trim()
          : undefined,
    });

    const headers = parsed.selectedWorksheet.headers;
    const mappingCheck = validateColumnMapping(headers, mapping, importType);

    const options: ImportValidationOptions = { strict };
    let summary = validateImportRows(
      importType,
      parsed.selectedWorksheet,
      mapping,
      options
    );

    if (importType === "PRODUCTS") {
      const maps = await loadCategoryUnitMaps();
      summary = applyProductMasterValidation(summary, maps);
    }

    const body: PreviewImportApiResponse = {
      success: true,
      mappingErrors: mappingCheck.errors,
      mappingValid: mappingCheck.ok,
      totalRows: summary.totalRows,
      validCount: summary.validCount,
      invalidCount: summary.invalidCount,
      previewRows: toPreviewPayload(summary.rows),
    };

    return NextResponse.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat pratinjau.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}