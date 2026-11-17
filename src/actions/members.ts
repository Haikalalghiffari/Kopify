"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const memberSchema = z.object({
  memberNo: z.string().min(1, "Nomor anggota wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  nik: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
  status: z.enum(["AKTIF", "NONAKTIF"]).default("AKTIF"),
});

export async function getMembers({
  page = 1,
  limit = 10,
  search = "",
  status = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { memberNo: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [members, total] = await Promise.all([
    db.member.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.member.count({ where }),
  ]);

  return {
    data: members,
    total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
}

export async function createMember(formData: z.infer<typeof memberSchema>) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const validated = memberSchema.parse(formData);

  const existing = await db.member.findUnique({
    where: { memberNo: validated.memberNo },
  });

  if (existing) {
    throw new Error("Nomor anggota sudah digunakan");
  }

  const member = await db.member.create({
    data: {
      memberNo: validated.memberNo,
      name: validated.name,
      nik: validated.nik || null,
      address: validated.address || null,
      phone: validated.phone || null,
      email: validated.email || null,
      status: validated.status,
    },
  });

  // Catat audit log
  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "CREATE_MEMBER",
      entity: "Member",
      entityId: member.id,
      detailJson: member,
    },
  });

  revalidatePath("/admin/members");
  return { success: true, member };
}

export async function updateMember(id: string, formData: Partial<z.infer<typeof memberSchema>>) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const current = await db.member.findUnique({ where: { id } });
  if (!current) throw new Error("Anggota tidak ditemukan");

  if (formData.memberNo && formData.memberNo !== current.memberNo) {
    const existing = await db.member.findUnique({
      where: { memberNo: formData.memberNo },
    });
    if (existing) throw new Error("Nomor anggota sudah digunakan");
  }

  const updated = await db.member.update({
    where: { id },
    data: {
      ...formData,
      email: formData.email || null,
      nik: formData.nik || null,
      address: formData.address || null,
      phone: formData.phone || null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "UPDATE_MEMBER",
      entity: "Member",
      entityId: id,
      detailJson: updated,
    },
  });

  revalidatePath("/admin/members");
  return { success: true, member: updated };
}

export async function deleteMember(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Soft delete
  const updated = await db.member.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "NONAKTIF",
    },
  });

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "DELETE_MEMBER",
      entity: "Member",
      entityId: id,
    },
  });

  revalidatePath("/admin/members");
  return { success: true };
}
