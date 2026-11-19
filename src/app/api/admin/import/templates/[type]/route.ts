import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  buildImportTemplateBuffer,
  templateFilename,
} from "@/lib/import/templates";
import type { ImportDataType } from "@/lib/import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { type: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(Role.ADMIN);
  } catch {
    return NextResponse.json(
      { success: false, error: "Akses ditolak." },
      { status: 403 }
    );
  }

  const type = params.type?.toUpperCase();
  if (type !== "MEMBERS" && type !== "PRODUCTS") {
    return NextResponse.json(
      { success: false, error: "Jenis template tidak dikenali." },
      { status: 400 }
    );
  }

  const buffer = buildImportTemplateBuffer(type as ImportDataType);
  const filename = templateFilename(type as ImportDataType);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}