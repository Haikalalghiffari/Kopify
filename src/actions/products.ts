"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const productSchema = z.object({
  sku: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(1, "Nama barang wajib diisi"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  unitId: z.string().min(1, "Satuan wajib dipilih"),
  costPrice: z.number().int().nonnegative("Harga beli minimal 0"),
  sellPrice: z.number().int().nonnegative("Harga jual minimal 0"),
  stock: z.number().int().default(0),
  minStock: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function getProducts({
  page = 1,
  limit = 10,
  search = "",
  categoryId = "",
  isActive = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: string;
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
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (isActive !== "") {
    where.isActive = isActive === "true";
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: true,
        unit: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.product.count({ where }),
  ]);

  return {
    data: products,
    total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
}

export async function createProduct(formData: z.infer<typeof productSchema>) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const validated = productSchema.parse(formData);

  const existing = await db.product.findUnique({
    where: { sku: validated.sku },
  });

  if (existing) {
    throw new Error("SKU sudah terdaftar");
  }

  return await db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: validated,
    });

    if (validated.stock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "IMPORT",
          qtyChange: validated.stock,
          stockBefore: 0,
          stockAfter: validated.stock,
          note: "Stok awal saat pendaftaran barang",
          createdById: (session.user as any).id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: "CREATE_PRODUCT",
        entity: "Product",
        entityId: product.id,
        detailJson: product,
      },
    });

    revalidatePath("/admin/products");
    return { success: true, product };
  });
}

export async function updateProduct(id: string, formData: Partial<z.infer<typeof productSchema>>) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const current = await db.product.findUnique({ where: { id } });
  if (!current) throw new Error("Barang tidak ditemukan");

  if (formData.sku && formData.sku !== current.sku) {
    const existing = await db.product.findUnique({
      where: { sku: formData.sku },
    });
    if (existing) throw new Error("SKU sudah digunakan");
  }

  // Notice: Direct stock editing is disallowed or handled via stock adjustments,
  // but if updated here we keep stock consistent or prevent stock field override.
  const { stock, ...updateData } = formData;

  const updated = await db.product.update({
    where: { id },
    data: updateData,
  });

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "UPDATE_PRODUCT",
      entity: "Product",
      entityId: id,
      detailJson: updated,
    },
  });

  revalidatePath("/admin/products");
  return { success: true, product: updated };
}

export async function deleteProduct(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Check if product has transactions or orders
  const [salesCount, orderCount] = await Promise.all([
    db.saleItem.count({ where: { productId: id } }),
    db.orderItem.count({ where: { productId: id } }),
  ]);

  if (salesCount > 0 || orderCount > 0) {
    // Only soft delete / deactivate
    await db.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  } else {
    // Soft delete
    await db.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "DELETE_PRODUCT",
      entity: "Product",
      entityId: id,
    },
  });

  revalidatePath("/admin/products");
  return { success: true };
}
