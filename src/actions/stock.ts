"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { restockProduct, adjustStock } from "@/services/stockService";

export async function getStockSummary() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const products = await db.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      stock: true,
      minStock: true,
      costPrice: true,
      sellPrice: true,
    },
  });

  const totalSKU = products.length;
  let totalInventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    totalInventoryValue += p.stock * p.costPrice;
    if (p.stock <= 0) {
      outOfStockCount++;
    } else if (p.stock <= p.minStock) {
      lowStockCount++;
    }
  }

  return {
    totalSKU,
    totalInventoryValue,
    lowStockCount,
    outOfStockCount,
  };
}

export async function getStockList({
  page = 1,
  limit = 10,
  search = "",
  status = "", // "LOW", "OUT", "SAFE", ""
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
    isActive: true,
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
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
      orderBy: [{ stock: "asc" }, { name: "asc" }],
    }),
    db.product.count({ where }),
  ]);

  // Filter in memory if status filter applied
  let filtered = products;
  if (status === "OUT") {
    filtered = products.filter((p) => p.stock <= 0);
  } else if (status === "LOW") {
    filtered = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  } else if (status === "SAFE") {
    filtered = products.filter((p) => p.stock > p.minStock);
  }

  return {
    data: filtered,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  };
}

export async function getStockMovements({
  productId = "",
  page = 1,
  limit = 20,
}: {
  productId?: string;
  page?: number;
  limit?: number;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const skip = (page - 1) * limit;
  const where: any = {};
  if (productId) {
    where.productId = productId;
  }

  const [movements, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: {
          select: {
            sku: true,
            name: true,
            unit: { select: { name: true } },
          },
        },
        createdBy: {
          select: { username: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.stockMovement.count({ where }),
  ]);

  return {
    data: movements,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  };
}

export async function handleRestock({
  productId,
  qty,
  newCostPrice,
  note,
}: {
  productId: string;
  qty: number;
  newCostPrice?: number;
  note: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const userId = (session.user as any).id;

  const result = await restockProduct({
    productId,
    qty,
    newCostPrice,
    note,
    userId,
  });

  revalidatePath("/admin/stock");
  revalidatePath("/admin/products");
  revalidatePath("/member/catalog");
  return { success: true, ...result };
}

export async function handleOpname({
  productId,
  actualPhysicalStock,
  reason,
}: {
  productId: string;
  actualPhysicalStock: number;
  reason: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const userId = (session.user as any).id;

  const result = await adjustStock({
    productId,
    actualPhysicalStock,
    reason,
    userId,
  });

  revalidatePath("/admin/stock");
  revalidatePath("/admin/products");
  revalidatePath("/member/catalog");
  return { success: true, ...result };
}
