import { Prisma, PrismaClient, StockMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AdjustStockParams,
  AdjustStockResult,
  CommitReservationParams,
  IStockService,
  ReceiveStockParams,
  ReleaseStockParams,
  ReserveStockParams,
  StockOpnameParams,
} from "./contracts";

type TransactionClient = Prisma.TransactionClient;

async function lockProduct(tx: TransactionClient, productId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`
  );

  if (rows.length === 0) {
    throw new Error(`Barang dengan ID ${productId} tidak ditemukan`);
  }

  return tx.product.findUniqueOrThrow({ where: { id: productId } });
}

function assertPositiveQuantity(qty: number, fieldName: string): void {
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error(`${fieldName} harus berupa bilangan bulat lebih dari 0`);
  }
}

export class StockService implements IStockService {
  constructor(private readonly prisma: PrismaClient = db) {}

  async adjustStock(params: AdjustStockParams): Promise<AdjustStockResult> {
    const { productId, qtyChange, type, refType, refId, note, userId } = params;

    if (!Number.isSafeInteger(qtyChange) || qtyChange === 0) {
      throw new Error("Perubahan stok harus berupa bilangan bulat selain 0");
    }
    if (
      (type === StockMovementType.PURCHASE || type === StockMovementType.ADJUSTMENT) &&
      !note?.trim()
    ) {
      throw new Error("Alasan barang masuk atau penyesuaian stok wajib diisi");
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await lockProduct(tx, productId);
      const stockBefore = product.stock;
      const stockAfter = stockBefore + qtyChange;

      if (stockAfter < product.reservedStock) {
        throw new Error(
          `Stok tersedia tidak cukup. Stok fisik: ${stockBefore}, tercadangkan: ${product.reservedStock}`
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: { stock: stockAfter },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type,
          qtyChange,
          stockBefore,
          stockAfter,
          refType,
          refId,
          note,
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action:
            type === StockMovementType.PURCHASE
              ? "RECEIVE_STOCK"
              : type === StockMovementType.ADJUSTMENT
                ? "STOCK_OPNAME"
                : "ADJUST_STOCK",
          entity: "Product",
          entityId: productId,
          detailJson: {
            type,
            qtyChange,
            stockBefore,
            stockAfter,
            refType: refType ?? null,
            refId: refId ?? null,
            note: note ?? null,
            movementId: movement.id,
          },
        },
      });

      return {
        productId,
        qtyChange,
        stockBefore,
        stockAfter,
        movementId: movement.id,
      };
    });
  }

  async receiveStock(params: ReceiveStockParams): Promise<AdjustStockResult> {
    assertPositiveQuantity(params.qty, "Jumlah stok masuk");
    if (!params.note.trim()) {
      throw new Error("Alasan barang masuk wajib diisi");
    }

    return this.adjustStock({
      productId: params.productId,
      qtyChange: params.qty,
      type: StockMovementType.PURCHASE,
      refType: "PURCHASE",
      refId: params.refId,
      note: params.note.trim(),
      userId: params.userId,
    });
  }

  async stockOpname(params: StockOpnameParams): Promise<AdjustStockResult> {
    const { productId, actualStock, note, userId } = params;

    if (!Number.isSafeInteger(actualStock) || actualStock < 0) {
      throw new Error("Hasil stok opname harus berupa bilangan bulat minimal 0");
    }

    if (!note.trim()) {
      throw new Error("Alasan stok opname wajib diisi");
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await lockProduct(tx, productId);

      if (actualStock < product.reservedStock) {
        throw new Error(
          `Hasil opname (${actualStock}) tidak boleh lebih kecil dari stok tercadangkan (${product.reservedStock})`
        );
      }

      const qtyChange = actualStock - product.stock;
      await tx.product.update({
        where: { id: productId },
        data: { stock: actualStock },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type: StockMovementType.ADJUSTMENT,
          qtyChange,
          stockBefore: product.stock,
          stockAfter: actualStock,
          refType: "STOCK_OPNAME",
          note: note.trim(),
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "STOCK_OPNAME",
          entity: "Product",
          entityId: productId,
          detailJson: {
            qtyChange,
            stockBefore: product.stock,
            stockAfter: actualStock,
            note: note.trim(),
            movementId: movement.id,
          },
        },
      });

      return {
        productId,
        qtyChange,
        stockBefore: product.stock,
        stockAfter: actualStock,
        movementId: movement.id,
      };
    });
  }

  async reserve(params: ReserveStockParams): Promise<void> {
    const { productId, qty, orderId } = params;
    assertPositiveQuantity(qty, "Jumlah reservasi");

    await this.prisma.$transaction(async (tx) => {
      const product = await lockProduct(tx, productId);
      const availableStock = product.stock - product.reservedStock;

      if (availableStock < qty) {
        throw new Error(
          `Stok tersedia tidak cukup untuk pesanan ${orderId}. Tersedia: ${availableStock}, diminta: ${qty}`
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: { reservedStock: product.reservedStock + qty },
      });
    });
  }

  async release(params: ReleaseStockParams): Promise<void> {
    const { productId, qty, orderId } = params;
    assertPositiveQuantity(qty, "Jumlah pelepasan reservasi");

    await this.prisma.$transaction(async (tx) => {
      const product = await lockProduct(tx, productId);

      if (product.reservedStock < qty) {
        throw new Error(
          `Reservasi stok untuk pesanan ${orderId} tidak cukup untuk dilepas. Tercadangkan: ${product.reservedStock}, diminta: ${qty}`
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: { reservedStock: product.reservedStock - qty },
      });
    });
  }

  async commitReservation({ orderId }: CommitReservationParams): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const orderRows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`
      );

      if (orderRows.length === 0) {
        throw new Error(`Pesanan dengan ID ${orderId} tidak ditemukan`);
      }

      const existingMovement = await tx.stockMovement.findFirst({
        where: {
          type: StockMovementType.ORDER_FULFILLED,
          refType: "ORDER",
          refId: orderId,
        },
        select: { id: true },
      });

      if (existingMovement) {
        return;
      }

      const orderItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, qty: true },
        orderBy: { productId: "asc" },
      });

      if (orderItems.length === 0) {
        throw new Error(`Pesanan ${orderId} tidak memiliki barang`);
      }

      const quantitiesByProduct = new Map<string, number>();
      for (const item of orderItems) {
        quantitiesByProduct.set(
          item.productId,
          (quantitiesByProduct.get(item.productId) ?? 0) + item.qty
        );
      }

      const productIds = Array.from(quantitiesByProduct.keys()).sort();
      const products = new Map<string, Awaited<ReturnType<typeof lockProduct>>>();

      for (const productId of productIds) {
        products.set(productId, await lockProduct(tx, productId));
      }

      for (const productId of productIds) {
        const product = products.get(productId);
        const qty = quantitiesByProduct.get(productId);
        if (!product || qty === undefined) {
          throw new Error(`Data stok barang ${productId} tidak ditemukan`);
        }

        if (product.stock < qty || product.reservedStock < qty) {
          throw new Error(
            `Reservasi stok tidak cukup untuk menyelesaikan pesanan ${orderId} pada barang ${product.name}`
          );
        }
      }

      for (const productId of productIds) {
        const product = products.get(productId);
        const qty = quantitiesByProduct.get(productId);
        if (!product || qty === undefined) {
          throw new Error(`Data stok barang ${productId} tidak ditemukan`);
        }

        const stockAfter = product.stock - qty;

        await tx.product.update({
          where: { id: productId },
          data: {
            stock: stockAfter,
            reservedStock: product.reservedStock - qty,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId,
            type: StockMovementType.ORDER_FULFILLED,
            qtyChange: -qty,
            stockBefore: product.stock,
            stockAfter,
            refType: "ORDER",
            refId: orderId,
            note: `Penyelesaian pesanan ${orderId}`,
          },
        });
      }
    });
  }
}

export const stockService: IStockService = new StockService();
