import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { listImportHistory } from "@/services/import/importService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);
  } catch {
    return NextResponse.json(
      { success: false, error: "Akses ditolak." },
      { status: 403 }
    );
  }

  const logs = await listImportHistory(50);
  const data = logs.map((log) => ({
    id: log.id,
    type: log.type,
    filename: log.filename,
    totalRows: log.totalRows,
    successRows: log.successRows,
    failedRows: log.failedRows,
    status: log.status,
    createdAt: log.createdAt.toISOString(),
    createdBy: log.user?.username ?? log.user?.email ?? "-",
    skippedRows:
      log.mappingJson &&
      typeof log.mappingJson === "object" &&
      "skippedRows" in (log.mappingJson as object)
        ? Number((log.mappingJson as { skippedRows?: number }).skippedRows) || 0
        : 0,
  }));

  return NextResponse.json({ success: true, data });
}