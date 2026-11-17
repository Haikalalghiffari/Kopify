import { db } from "@/lib/db";
import { StockMovementType } from "@prisma/client";

export interface StockChangeParams {
  productId: string;
  type: StockMovementType;
  qtyChange: number; // positive for addition, negative for deduction
  note: string;
  refType?: string;
  refId?: string;
  userId: string;
}

/**
 * Execute an atomic stock movement inside a database transaction
 * Ensures stock never goes below zero (FR-4.4 & AC 6.4)
 */
export async function executeStockMovement({
  productId,
  type,
  qtyChange,
  note,
  refType,
  refId,
  userId,
}: StockChangeParams) {
  return await db.$transaction(async (tx) => {
    // 1. Fetch current product
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error("Barang tidak ditemukan");
    }

    const currentStock = product.stock;
    const newStock = currentStock + qtyChange;

    // AC 6.4: Stok tidak boleh negatif
    if (newStock < 0) {
      throw new Error(
        `Stok tidak mencukupi untuk ${product.name}. Stok saat ini: ${currentStock}, perubahan: ${qtyChange}`
      );
    }

    // 2. Record stock movement audit trail
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type,
        qtyChange,
        stockBefore: currentStock,
        stockAfter: newStock,
        note,
        refType,
        refId,
        createdById: userId,
      },
    });

    // 3. Update product physical stock
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    return { movement, product: updatedProduct };
  });
}

/**
 * Form barang masuk / restock (FR-4.2)
 */
export async function restockProduct({
  productId,
  qty,
  newCostPrice,
  note,
  userId,
}: {
  productId: string;
  qty: number;
  newCostPrice?: number;
  note: string;
  userId: string;
}) {
  if (qty <= 0) {
    throw new Error("Jumlah barang masuk harus lebih dari 0");
  }

  return await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Barang tidak ditemukan");

    const currentStock = product.stock;
    const newStock = currentStock + qty;

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type: "PURCHASE",
        qtyChange: qty,
        stockBefore: currentStock,
        stockAfter: newStock,
        note: note || "Barang masuk (restock)",
        createdById: userId,
      },
    });

    const updateData: any = { stock: newStock };
    if (newCostPrice !== undefined && newCostPrice > 0) {
      updateData.costPrice = newCostPrice;
    }

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: updateData,
    });

    return { movement, product: updatedProduct };
  });
}

/**
 * Form opname / penyesuaian stok fisik (FR-4.2 dengan alasan wajib)
 */
export async function adjustStock({
  productId,
  actualPhysicalStock,
  reason,
  userId,
}: {
  productId: string;
  actualPhysicalStock: number;
  reason: string;
  userId: string;
}) {
  if (actualPhysicalStock < 0) {
    throw new Error("Stok fisik tidak boleh negatif");
  }

  if (!reason || reason.trim().length < 3) {
    throw new Error("Alasan penyesuaian stok fisik wajib diisi (minimal 3 karakter)");
  }

  return await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Barang tidak ditemukan");

    const currentStock = product.stock;
    const diff = actualPhysicalStock - currentStock;

    if (diff === 0) {
      throw new Error("Stok fisik sama dengan stok sistem, tidak ada perubahan yang dicatat");
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type: "ADJUSTMENT",
        qtyChange: diff,
        stockBefore: currentStock,
        stockAfter: actualPhysicalStock,
        note: `Opname Fisik: ${reason.trim()}`,
        createdById: userId,
      },
    });

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: actualPhysicalStock },
    });

    return { movement, product: updatedProduct };
  });
}
