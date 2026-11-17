"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  return await db.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await db.category.findUnique({ where: { name } });
  if (existing) throw new Error("Kategori sudah ada");

  const category = await db.category.create({ data: { name } });
  revalidatePath("/admin/products");
  return category;
}

export async function getUnits() {
  return await db.unit.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createUnit(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await db.unit.findUnique({ where: { name } });
  if (existing) throw new Error("Satuan sudah ada");

  const unit = await db.unit.create({ data: { name } });
  revalidatePath("/admin/products");
  return unit;
}
