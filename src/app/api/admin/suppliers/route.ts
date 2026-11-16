import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePagination } from "@/lib/pagination";

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nama pemasok wajib diisi.").max(255),
  phone: z.string().trim().max(32).nullish(),
  address: z.string().trim().max(1000).nullish(),
});
const updateSchema = supplierSchema.extend({
  action: z.literal("UPDATE"),
  id: z.string().min(1),
});
const restoreSchema = z.object({
  action: z.literal("RESTORE"),
  id: z.string().min(1),
});
const deleteSchema = z.object({
  id: z.string().min(1),
});

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ message: "Silakan login kembali." }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "KASIR") {
    return { response: NextResponse.json({ message: "Anda tidak memiliki izin." }, { status: 403 }) };
  }
  return { user: session.user };
}

async function readJson(request: Request): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json({ message: "Format request tidak valid." }, { status: 400 });
  }
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function paginationMeta(totalItems: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function supplierData(data: z.infer<typeof supplierSchema>) {
  return {
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
  };
}

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "ACTIVE";
  if (!["ACTIVE", "DELETED", "ALL"].includes(status)) {
    return NextResponse.json({ message: "Filter status tidak valid." }, { status: 400 });
  }

  const search = searchParams.get("search")?.trim() ?? "";
  const sortBy = searchParams.get("sortBy") === "createdAt" ? "createdAt" : "name";
  const sortOrder: Prisma.SortOrder =
    searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const { page, pageSize, skip, take } = normalizePagination({
    page: Number.parseInt(searchParams.get("page") ?? "", 10) || 1,
    pageSize: Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 10,
  });

  const where: Prisma.SupplierWhereInput = {
    ...(status === "ACTIVE"
      ? { deletedAt: null }
      : status === "DELETED"
        ? { deletedAt: { not: null } }
        : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [suppliers, totalItems] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    db.supplier.count({ where }),
  ]);
  return NextResponse.json({
    data: suppliers,
    meta: paginationMeta(totalItems, page, pageSize),
  });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data pemasok tidak valid." },
      { status: 400 }
    );
  }

  const supplier = await db.$transaction(async (tx) => {
    const created = await tx.supplier.create({ data: supplierData(parsed.data) });
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "CREATE_SUPPLIER",
        entity: "Supplier",
        entityId: created.id,
        detailJson: { name: created.name },
      },
    });
    return created;
  });
  return NextResponse.json({ data: supplier }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = z.discriminatedUnion("action", [updateSchema, restoreSchema]).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data pemasok tidak valid." },
      { status: 400 }
    );
  }

  const supplier = await db.$transaction(async (tx) => {
    if (parsed.data.action === "RESTORE") {
      const existing = await tx.supplier.findFirst({
        where: { id: parsed.data.id, deletedAt: { not: null } },
        select: { id: true },
      });
      if (!existing) return null;

      const restored = await tx.supplier.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "RESTORE_SUPPLIER",
          entity: "Supplier",
          entityId: restored.id,
          detailJson: { name: restored.name },
        },
      });
      return restored;
    }

    const existing = await tx.supplier.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await tx.supplier.update({
      where: { id: existing.id },
      data: supplierData(parsed.data),
    });
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "UPDATE_SUPPLIER",
        entity: "Supplier",
        entityId: updated.id,
        detailJson: { name: updated.name },
      },
    });
    return updated;
  });

  if (!supplier) {
    return NextResponse.json(
      { message: "Pemasok tidak ditemukan atau sudah diarsipkan." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: supplier });
}

export async function DELETE(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "ID pemasok tidak valid." }, { status: 400 });
  }

  const supplier = await db.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "suppliers" WHERE "id" = ${parsed.data.id} FOR UPDATE`
    );
    const existing = await tx.supplier.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) return null;

    const archived = await tx.supplier.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "DELETE_SUPPLIER",
        entity: "Supplier",
        entityId: archived.id,
        detailJson: { name: archived.name },
      },
    });
    return archived;
  });

  if (!supplier) {
    return NextResponse.json({ message: "Pemasok tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ message: "Pemasok berhasil diarsipkan." });
}