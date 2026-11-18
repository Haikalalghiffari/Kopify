import { NextResponse } from "next/server";
import { MemberStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePagination } from "@/lib/pagination";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal bergabung tidak valid.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal bergabung tidak valid.");

const emailSchema = z
  .union([
    z.string().trim().email("Format email tidak valid.").max(255),
    z.literal(""),
  ])
  .nullish();

const memberSchema = z.object({
  memberNo: z.string().trim().min(1, "Nomor anggota wajib diisi.").max(32),
  name: z.string().trim().min(1, "Nama anggota wajib diisi.").max(255),
  nik: z.string().trim().max(32).nullish(),
  address: z.string().trim().max(1000).nullish(),
  phone: z.string().trim().max(32).nullish(),
  email: emailSchema,
  joinedAt: dateOnlySchema,
  status: z.nativeEnum(MemberStatus),
});

const updateSchema = memberSchema.extend({
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

function memberData(data: z.infer<typeof memberSchema>) {
  return {
    memberNo: data.memberNo.trim().toUpperCase(),
    name: data.name.trim(),
    nik: data.nik?.trim() || null,
    address: data.address?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim().toLowerCase() || null,
    joinedAt: new Date(`${data.joinedAt}T00:00:00.000Z`),
    status: data.status,
  };
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

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "AKTIF";
  if (!["AKTIF", "NONAKTIF", "ARSIP", "ALL"].includes(status)) {
    return NextResponse.json({ message: "Filter status tidak valid." }, { status: 400 });
  }

  const search = searchParams.get("search")?.trim() ?? "";
  const sortBy =
    searchParams.get("sortBy") === "memberNo"
      ? "memberNo"
      : searchParams.get("sortBy") === "joinedAt"
        ? "joinedAt"
        : "name";
  const sortOrder: Prisma.SortOrder =
    searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const { page, pageSize, skip, take } = normalizePagination({
    page: Number.parseInt(searchParams.get("page") ?? "", 10) || 1,
    pageSize: Number.parseInt(searchParams.get("pageSize") ?? "", 10) || 10,
  });

  const statusFilter: Prisma.MemberWhereInput =
    status === "AKTIF"
      ? { deletedAt: null, status: MemberStatus.AKTIF }
      : status === "NONAKTIF"
        ? { deletedAt: null, status: MemberStatus.NONAKTIF }
        : status === "ARSIP"
          ? { deletedAt: { not: null } }
          : {};
  const where: Prisma.MemberWhereInput = {
    ...statusFilter,
    ...(search
      ? {
          OR: [
            { memberNo: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { nik: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [members, totalItems] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    db.member.count({ where }),
  ]);

  return NextResponse.json({
    data: members,
    meta: paginationMeta(totalItems, page, pageSize),
  });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Data anggota tidak valid." },
      { status: 400 }
    );
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const member = await tx.member.create({ data: memberData(parsed.data) });
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "CREATE_MEMBER",
          entity: "Member",
          entityId: member.id,
          detailJson: { memberNo: member.memberNo, name: member.name },
        },
      });
      return member;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { message: "Nomor anggota atau NIK sudah digunakan." },
        { status: 409 }
      );
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
      { message: parsed.error.issues[0]?.message ?? "Data anggota tidak valid." },
      { status: 400 }
    );
  }

  try {
    const member = await db.$transaction(async (tx) => {
      if (parsed.data.action === "RESTORE") {
        const existing = await tx.member.findFirst({
          where: { id: parsed.data.id, deletedAt: { not: null } },
          select: { id: true },
        });
        if (!existing) return null;

        const restored = await tx.member.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
        await tx.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "RESTORE_MEMBER",
            entity: "Member",
            entityId: restored.id,
            detailJson: { memberNo: restored.memberNo, name: restored.name },
          },
        });
        return restored;
      }

      const existing = await tx.member.findFirst({
        where: { id: parsed.data.id, deletedAt: null },
        include: { user: { select: { id: true } } },
      });
      if (!existing) return null;

      const updated = await tx.member.update({
        where: { id: existing.id },
        data: memberData(parsed.data),
      });
      if (parsed.data.status === MemberStatus.NONAKTIF && existing.user) {
        await tx.user.update({
          where: { id: existing.user.id },
          data: { isActive: false },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "UPDATE_MEMBER",
          entity: "Member",
          entityId: updated.id,
          detailJson: { memberNo: updated.memberNo, name: updated.name },
        },
      });
      return updated;
    });

    if (!member) {
      return NextResponse.json(
        { message: "Anggota tidak ditemukan atau sudah diarsipkan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: member });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { message: "Nomor anggota atau NIK sudah digunakan." },
        { status: 409 }
      );
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
    return NextResponse.json({ message: "ID anggota tidak valid." }, { status: 400 });
  }

  const member = await db.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "members" WHERE "id" = ${parsed.data.id} FOR UPDATE`
    );
    const existing = await tx.member.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      include: { user: { select: { id: true } } },
    });
    if (!existing) return null;

    const archived = await tx.member.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    if (existing.user) {
      await tx.user.update({
        where: { id: existing.user.id },
        data: { isActive: false },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "DELETE_MEMBER",
        entity: "Member",
        entityId: archived.id,
        detailJson: { memberNo: archived.memberNo, name: archived.name },
      },
    });
    return archived;
  });

  if (!member) {
    return NextResponse.json({ message: "Anggota tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ message: "Anggota berhasil diarsipkan." });
}