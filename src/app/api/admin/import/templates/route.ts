import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { parseImportType } from "@/lib/import/sessionPayload";
import type { ColumnMapping, ImportDataType } from "@/lib/import/types";
import {
  listImportTemplates,
  saveImportTemplate,
  deleteImportTemplate,
} from "@/services/import/mappingTemplateService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    const user = await requireRole(Role.ADMIN);
    userId = user.id;
  } catch {
    return NextResponse.json({ success: false, error: "Akses ditolak." }, { status: 403 });
  }

  const typeParam = request.nextUrl.searchParams.get("type")?.toUpperCase();
  const importType =
    typeParam === "MEMBERS" || typeParam === "PRODUCTS"
      ? (typeParam as ImportDataType)
      : "MEMBERS";

  const templates = await listImportTemplates(importType, userId);
  return NextResponse.json({ success: true, data: templates });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    const user = await requireRole(Role.ADMIN);
    userId = user.id;
  } catch {
    return NextResponse.json({ success: false, error: "Akses ditolak." }, { status: 403 });
  }

  let body: { type?: string; name?: string; mapping?: ColumnMapping };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON tidak valid." },
      { status: 400 }
    );
  }

  const importType =
    body.type === "PRODUCTS" || body.type === "MEMBERS"
      ? body.type
      : parseImportType(body.type ?? null);
  if (!importType) {
    return NextResponse.json(
      { success: false, error: "Jenis template tidak valid." },
      { status: 400 }
    );
  }
  if (!body.mapping || typeof body.mapping !== "object") {
    return NextResponse.json(
      { success: false, error: "Pemetaan kolom wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const saved = await saveImportTemplate({
      type: importType,
      name: body.name ?? "Template tanpa nama",
      mapping: body.mapping,
      userId,
    });
    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan template.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  let userId: string;
  try {
    const user = await requireRole(Role.ADMIN);
    userId = user.id;
  } catch {
    return NextResponse.json({ success: false, error: "Akses ditolak." }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID template wajib diisi." },
      { status: 400 }
    );
  }

  try {
    await deleteImportTemplate(id, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menghapus template.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}