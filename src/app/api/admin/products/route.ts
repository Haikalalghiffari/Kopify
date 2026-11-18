import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePagination } from "@/lib/pagination";

const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU wajib diisi").max(64),
  name: z.string().trim().min(1, "Nama barang wajib diisi").max(255),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  unitId: z.string().min(1, "Satuan wajib dipilih"),
  costPrice: z.number().int().min(0).max(2_147_483_647),
  sellPrice: z.number().int().min(0).max(2_147_483_647),
  minStock: z.number().int().min(0).max(2_147_483_647),
});

const updateProductSchema = productSchema.extend({
  id: z.string().min(1, "ID barang wajib diisi"),
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

async function lockActiveLookups(
  tx: Prisma.TransactionClient,
  categoryId: string,
  unitId: string
): Promise<boolean> {
  const categories = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "categories" WHERE "id" = ${categoryId} AND "deleted_at" IS NULL FOR UPDATE`
  );
  const units = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "units" WHERE "id" = ${unitId} AND "deleted_at" IS NULL FOR UPDATE`
  );
  return categories.length > 0 && units.length > 0;
}

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const categoryId = searchParams.get("categoryId") ?? "ALL";
  const parsedSortBy = z.enum(["name", "sku", "sellPrice"]).safeParse(
    searchParams.get("sortBy") ?? "name"
  );
  const parsedSortOrder = z.enum(["asc", "desc"]).safeParse(
    searchParams.get("sortOrder") ?? "asc"
  );
  if (!parsedSortBy.success || !parsedSortOrder.success) {
    return NextResponse.json({ message: "Urutan barang tidak valid." }, { status: 400 });
  }

  const { page, pageSize, skip, take } = normalizePagination({
    page: Number.parseInt(searchParams.get("page") ?? "", 10) || 1,
    pageSize: Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 10,
  });

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(categoryId !== "ALL" ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [parsedSortBy.data]: parsedSortOrder.data,
  };

  const [products, totalItems, categories, units] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take,
    }),
    db.product.count({ where }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.unit.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({
    data: products,
    categories,
    units,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      hasNextPage: page * pageSize < totalItems,
      hasPrevPage: page > 1,
    },
  });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;

  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data barang tidak valid." },
      { status: 400 }
    );
  }

  try {
    const product = await db.$transaction(async (tx) => {
      if (!await lockActiveLookups(tx, parsed.data.categoryId, parsed.data.unitId)) {
        return null;
      }

      const created = await tx.product.create({ data: parsed.data });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "CREATE_PRODUCT",
          entity: "Product",
          entityId: created.id,
          detailJson: { sku: created.sku, name: created.name },
        },
      });
      return created;
    });

    if (!product) {
      return NextResponse.json(
        { message: "Kategori atau satuan tidak aktif atau tidak ditemukan." },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json({ message: "SKU tersebut sudah digunakan." }, { status: 409 });
    }
    if (isPrismaError(error, "P2003")) {
      return NextResponse.json({ message: "Kategori atau satuan tidak ditemukan." }, { status: 400 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data barang tidak valid." },
      { status: 400 }
    );
  }

  const { id, ...data } = parsed.data;
  try {
    const product = await db.$transaction(async (tx) => {
      if (!await lockActiveLookups(tx, data.categoryId, data.unitId)) {
        return "inactive-lookup" as const;
      }

      const existing = await tx.product.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!existing) return null;

      const updated = await tx.product.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "UPDATE_PRODUCT",
          entity: "Product",
          entityId: updated.id,
          detailJson: { sku: updated.sku, name: updated.name },
        },
      });
      return updated;
    });

    if (product === "inactive-lookup") {
      return NextResponse.json(
        { message: "Kategori atau satuan tidak aktif atau tidak ditemukan." },
        { status: 400 }
      );
    }
    if (!product) {
      return NextResponse.json({ message: "Barang tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ data: product });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json({ message: "SKU tersebut sudah digunakan." }, { status: 409 });
    }
    if (isPrismaError(error, "P2003")) {
      return NextResponse.json({ message: "Kategori atau satuan tidak ditemukan." }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;

  const parsed = z.object({ id: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "ID barang tidak valid." }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${parsed.data.id} FOR UPDATE`
    );
    const product = await tx.product.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      select: { id: true, sku: true, name: true, reservedStock: true },
    });
    if (!product) return "not-found" as const;
    if (product.reservedStock > 0) return "reserved" as const;

    await tx.product.update({
      where: { id: product.id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "DELETE_PRODUCT",
        entity: "Product",
        entityId: product.id,
        detailJson: { sku: product.sku, name: product.name },
      },
    });
    return "deleted" as const;
  });

  if (result === "not-found") {
    return NextResponse.json({ message: "Barang tidak ditemukan." }, { status: 404 });
  }
  if (result === "reserved") {
    return NextResponse.json(
      { message: "Barang tidak dapat dihapus karena masih memiliki stok tercadangkan." },
      { status: 409 }
    );
  }

  return NextResponse.json({ message: "Barang berhasil dinonaktifkan." });
}
