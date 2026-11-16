import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { suggestColumnMapping, validateColumnMapping } from "@/lib/import/columnMapping";
import { parseImportFile } from "@/lib/import/parseSpreadsheet";
import {
  parseImportType,
  type ParseImportApiResponse,
} from "@/lib/import/sessionPayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);
  } catch {
    return NextResponse.json(
      { success: false, error: "Akses ditolak. Hanya admin yang dapat mengimpor data." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Permintaan tidak valid." },
      { status: 400 }
    );
  }

  const importType = parseImportType(formData.get("importType"));
  if (!importType) {
    return NextResponse.json(
      { success: false, error: "Jenis impor tidak valid." },
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
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const parsed = parseImportFile(buffer, file.name, {
      worksheetName:
        typeof worksheetName === "string" && worksheetName.trim()
          ? worksheetName.trim()
          : undefined,
    });

    const headers = parsed.selectedWorksheet.headers;
    const suggestedMapping = suggestColumnMapping(headers, importType);
    validateColumnMapping(headers, suggestedMapping, importType);

    const body: ParseImportApiResponse = {
      success: true,
      format: parsed.format,
      filename: file.name,
      worksheets: parsed.worksheets,
      selectedWorksheet: parsed.selectedWorksheet.name,
      headers,
      suggestedMapping,
      totalDataRows: parsed.selectedWorksheet.totalDataRows,
    };

    return NextResponse.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses file.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}