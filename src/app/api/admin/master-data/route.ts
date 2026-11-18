import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePagination } from "@/lib/pagination";

const typeSchema = z.enum(["CATEGORY", "UNIT"]);
const statusSchema = z.enum(["ACTIVE", "DELETED", "ALL"]);
const createSchema = z.object({
  type: typeSchema,
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
});
const updateSchema = z.object({
  action: z.literal("UPDATE"),
  type: typeSchema,
  id: z.string().min(1),
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
});
const restoreSchema = z.object({
  action: z.literal("RESTORE"),
  type: typeSchema,
  id: z.string().min(1),
});
const deleteSchema = z.object({
  type: typeSchema,
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

function metadata(totalItems: number, page: number, pageSize: number) {
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

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const { searchParams } = new URL(request.url);
  const parsedType = typeSchema.safeParse(searchParams.get("type"));
  const parsedStatus = statusSchema.safeParse(searchParams.get("status") ?? "ACTIVE");
  if (!parsedType.success || !parsedStatus.success) {
    return NextResponse.json({ message: "Jenis atau status data tidak valid." }, { status: 400 });
  }

  const search = searchParams.get("search")?.trim() ?? "";
  const sortBy = searchParams.get("sortBy") === "createdAt" ? "createdAt" : "name";
  const sortOrder: Prisma.SortOrder =
    searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const { page, pageSize, skip, take } = normalizePagination({
    page: Number.parseInt(searchParams.get("page") ?? "", 10) || 1,
    pageSize: Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 10,
  });
  const deletedAtFilter =
    parsedStatus.data === "ACTIVE"
      ? { deletedAt: null }
      : parsedStatus.data === "DELETED"
        ? { deletedAt: { not: null } }
        : {};

  if (parsedType.data === "CATEGORY") {
    const where: Prisma.CategoryWhereInput = {
      ...deletedAtFilter,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const orderBy =
      sortBy === "createdAt" ? { createdAt: sortOrder } : { name: sortOrder };
    const [data, totalItems] = await Promise.all([
      db.category.findMany({
        where,
        select: {
          id: true,
          name: true,
          deletedAt: true,
          createdAt: true,
          _count: { select: { products: { where: { deletedAt: null } } } },
        },
        orderBy,
        skip,
        take,
      }),
      db.category.count({ where }),
    ]);
    return NextResponse.json({ data, meta: metadata(totalItems, page, pageSize) });
  }

  const where: Prisma.UnitWhereInput = {
    ...deletedAtFilter,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortOrder } : { name: sortOrder };
  const [data, totalItems] = await Promise.all([
    db.unit.findMany({
      where,
      select: {
        id: true,
        name: true,
        deletedAt: true,
        createdAt: true,
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
      orderBy,
      skip,
      take,
    }),
    db.unit.count({ where }),
  ]);
  return NextResponse.json({ data, meta: metadata(totalItems, page, pageSize) });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const record =
        parsed.data.type === "CATEGORY"
          ? await tx.category.create({ data: { name: parsed.data.name } })
          : await tx.unit.create({ data: { name: parsed.data.name } });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: `CREATE_${parsed.data.type}`,
          entity: parsed.data.type === "CATEGORY" ? "Category" : "Unit",
          entityId: record.id,
          detailJson: { name: record.name },
        },
      });
      return record;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json({ message: "Nama tersebut sudah digunakan." }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = z.discriminatedUnion("action", [updateSchema, restoreSchema]).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const isRestore = parsed.data.action === "RESTORE";
  try {
    const updated = await db.$transaction(async (tx) => {
    if (parsed.data.type === "CATEGORY") {
      const where = isRestore
        ? { id: parsed.data.id, deletedAt: { not: null } }
        : { id: parsed.data.id, deletedAt: null };
      const existing = await tx.category.findFirst({ where, select: { id: true } });
      if (!existing) return null;
      const record = await tx.category.update({
        where: { id: existing.id },
        data:
          parsed.data.action === "RESTORE"
            ? { deletedAt: null }
            : { name: parsed.data.name },
      });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: `${isRestore ? "RESTORE" : "UPDATE"}_CATEGORY`,
          entity: "Category",
          entityId: record.id,
          detailJson: { name: record.name },
        },
      });
      return record;
    }

    const where = isRestore
      ? { id: parsed.data.id, deletedAt: { not: null } }
      : { id: parsed.data.id, deletedAt: null };
    const existing = await tx.unit.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    const record = await tx.unit.update({
      where: { id: existing.id },
      data:
        parsed.data.action === "RESTORE"
          ? { deletedAt: null }
          : { name: parsed.data.name },
    });
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: `${isRestore ? "RESTORE" : "UPDATE"}_UNIT`,
        entity: "Unit",
        entityId: record.id,
        detailJson: { name: record.name },
      },
    });
    return record;
    });

    if (!updated) {
      return NextResponse.json({ message: "Data tidak ditemukan atau statusnya sudah berubah." }, { status: 404 });
    }
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json({ message: "Nama tersebut sudah digunakan." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Jenis atau ID data tidak valid." }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    if (parsed.data.type === "CATEGORY") {
      await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "categories" WHERE "id" = ${parsed.data.id} FOR UPDATE`
      );
      const record = await tx.category.findFirst({
        where: { id: parsed.data.id, deletedAt: null },
        select: { id: true, name: true, _count: { select: { products: { where: { deletedAt: null } } } } },
      });
      if (!record) return "not-found" as const;
      if (record._count.products > 0) return "in-use" as const;
      await tx.category.update({ where: { id: record.id }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "DELETE_CATEGORY",
          entity: "Category",
          entityId: record.id,
          detailJson: { name: record.name },
        },
      });
      return "deleted" as const;
    }

    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "units" WHERE "id" = ${parsed.data.id} FOR UPDATE`
    );
    const record = await tx.unit.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      select: { id: true, name: true, _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    if (!record) return "not-found" as const;
    if (record._count.products > 0) return "in-use" as const;
    await tx.unit.update({ where: { id: record.id }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "DELETE_UNIT",
        entity: "Unit",
        entityId: record.id,
        detailJson: { name: record.name },
      },
    });
    return "deleted" as const;
  });

  if (result === "not-found") {
    return NextResponse.json({ message: "Data tidak ditemukan." }, { status: 404 });
  }
  if (result === "in-use") {
    return NextResponse.json(
      { message: "Data masih digunakan barang aktif. Ubah kategori atau satuan barang tersebut terlebih dahulu." },
      { status: 409 }
    );
  }
  return NextResponse.json({ message: "Data berhasil diarsipkan." });
}
