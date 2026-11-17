"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["ADMIN", "KASIR", "ANGGOTA"]),
  memberId: z.string().optional().nullable(),
});

export async function getUsers() {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden: Hanya Admin yang dapat mengelola pengguna");
  }

  return await db.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      member: {
        select: {
          id: true,
          memberNo: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(data: z.infer<typeof createUserSchema>) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  const validated = createUserSchema.parse(data);

  const existingEmail = await db.user.findUnique({ where: { email: validated.email } });
  if (existingEmail) throw new Error("Email sudah terdaftar");

  const existingUsername = await db.user.findUnique({ where: { username: validated.username } });
  if (existingUsername) throw new Error("Username sudah digunakan");

  const passwordHash = await bcrypt.hash(validated.password, 12);

  const newUser = await db.user.create({
    data: {
      username: validated.username,
      email: validated.email,
      passwordHash,
      role: validated.role,
      memberId: validated.memberId || null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "CREATE_USER",
      entity: "User",
      entityId: newUser.id,
    },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserStatus(id: string, isActive: boolean) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  if (id === (session.user as any).id) {
    throw new Error("Tidak dapat menonaktifkan akun sendiri");
  }

  await db.user.update({
    where: { id },
    data: { isActive },
  });

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entity: "User",
      entityId: id,
    },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function resetUserPassword(id: string, newPassword: string) {
  const session = await auth();
  if (!session || (session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  if (newPassword.length < 6) {
    throw new Error("Password minimal 6 karakter");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id },
    data: { passwordHash },
  });

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "RESET_PASSWORD",
      entity: "User",
      entityId: id,
    },
  });

  return { success: true };
}

export async function updateOwnProfile({
  name,
  currentPassword,
  newPassword,
}: {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const userId = (session.user as any).id;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { member: true },
  });

  if (!user) throw new Error("User tidak ditemukan");

  const updateData: any = {};

  if (newPassword) {
    if (!currentPassword) {
      throw new Error("Password saat ini wajib diisi untuk mengubah password");
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new Error("Password saat ini salah");
    }
    if (newPassword.length < 6) {
      throw new Error("Password baru minimal 6 karakter");
    }
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updateData).length > 0) {
    await db.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  if (name && user.memberId) {
    await db.member.update({
      where: { id: user.memberId },
      data: { name },
    });
  }

  return { success: true };
}
