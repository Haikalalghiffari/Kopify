import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getImportLogById } from "@/services/import/importService";
import { parseImportLogMetadata } from "@/lib/import/importLogMeta";
import { buildImportErrorReportBuffer } from "@/lib/import/errorReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(Role.ADMIN);
  } catch {
    return NextResponse.json(
      { success: false, error: "Akses ditolak." },
      { status: 403 }
    );
  }

  const log = await getImportLogById(params.id);
  if (!log) {
    return NextResponse.json(
      { success: false, error: "Riwayat impor tidak ditemukan." },
      { status: 404 }
    );
  }

  const meta = parseImportLogMetadata(log.mappingJson);
  const errors = meta?.errors ?? [];
  const buffer = buildImportErrorReportBuffer(errors, log.filename);
  const baseName = log.filename.replace(/\.[^.]+$/, "");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="error-${baseName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}