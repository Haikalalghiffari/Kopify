
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
  StockTransactionClient,
} from "./contracts";

// ==========================================
// HELPER
// ==========================================

async function lockProduct(
  tx: StockTransactionClient,
  productId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "products"
      WHERE "id" = ${productId}
      FOR UPDATE
    `
  );

  if (rows.length === 0) {
    throw new Error(`Barang dengan ID ${productId} tidak ditemukan`);
  }

  return tx.product.findUniqueOrThrow({
    where: { id: productId },
  });
}

async function lockOrder(
  tx: StockTransactionClient,
  orderId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "orders"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `
  );

  if (rows.length === 0) {
    throw new Error(`Pesanan dengan ID ${orderId} tidak ditemukan`);
  }
}

function assertPositiveQuantity(qty: number, fieldName: string): void {
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error(
      `${fieldName} harus berupa bilangan bulat lebih dari 0`
    );
  }
}

// ==========================================
// STOCK SERVICE
// ==========================================

export class StockService implements IStockService {
  constructor(private readonly prisma: PrismaClient = db) {}

  // ==========================================
  // ADJUST STOCK
  // Bisa menggunakan transaksi eksternal.
  // Jika tx tidak diberikan, transaksi dibuat sendiri.
  // ==========================================

  async adjustStock(
    params: AdjustStockParams,
    tx?: StockTransactionClient
  ): Promise<AdjustStockResult> {
    const {
      productId,
      qtyChange,
      type,
      refType,
      refId,
      note,
      userId,
    } = params;

    if (!Number.isSafeInteger(qtyChange) || qtyChange === 0) {
      throw new Error(
        "Perubahan stok harus berupa bilangan bulat selain 0"
      );
    }

    if (
      (type === StockMovementType.PURCHASE ||
        type === StockMovementType.ADJUSTMENT) &&
      !note?.trim()
    ) {
      throw new Error(
        "Alasan barang masuk atau penyesuaian stok wajib diisi"
      );
    }

    const execute = async (
      transaction: StockTransactionClient
    ): Promise<AdjustStockResult> => {
      const product = await lockProduct(transaction, productId);

      const stockBefore = product.stock;
      const stockAfter = stockBefore + qtyChange;

      if (stockAfter < product.reservedStock) {
        throw new Error(
          `Stok tersedia tidak cukup. Stok fisik: ${stockBefore}, tercadangkan: ${product.reservedStock}`
        );
      }

      await transaction.product.update({
        where: { id: productId },
        data: { stock: stockAfter },
      });

      const movement = await transaction.stockMovement.create({
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

      await transaction.auditLog.create({
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
    };

    // Gunakan transaksi dari pemanggil jika tersedia.
    if (tx) {
      return execute(tx);
    }

    // Jika tidak tersedia, buat transaksi sendiri.
    return this.prisma.$transaction(execute);
  }

  // ==========================================
  // RECEIVE STOCK
  // ==========================================

  async receiveStock(
    params: ReceiveStockParams
  ): Promise<AdjustStockResult> {
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

  // ==========================================
  // STOCK OPNAME
  // ==========================================

  async stockOpname(
    params: StockOpnameParams
  ): Promise<AdjustStockResult> {
    const { productId, actualStock, note, userId } = params;

    if (!Number.isSafeInteger(actualStock) || actualStock < 0) {
      throw new Error(
        "Hasil stok opname harus berupa bilangan bulat minimal 0"
      );
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

  // ==========================================
  // RESERVE STOCK
  // Mencatat reservasi berdasarkan orderId.
  // ==========================================

  async reserve(params: ReserveStockParams): Promise<void> {
    const { productId, qty, orderId } = params;

    assertPositiveQuantity(qty, "Jumlah reservasi");

    await this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);

      const product = await lockProduct(tx, productId);

      // Cegah reservasi aktif ganda untuk produk dan pesanan sama.
      const existingReservation =
        await tx.stockReservation.findFirst({
          where: {
            orderId,
            productId,
            status: "ACTIVE",
            remainingQty: { gt: 0 },
          },
        });

      if (existingReservation) {
        throw new Error(
          `Reservasi aktif untuk barang ${product.name} pada pesanan ${orderId} sudah ada`
        );
      }

      const availableStock = product.stock - product.reservedStock;

      if (availableStock < qty) {
        throw new Error(
          `Stok tersedia tidak cukup untuk pesanan ${orderId}. Tersedia: ${availableStock}, diminta: ${qty}`
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          reservedStock: product.reservedStock + qty,
        },
      });

      await tx.stockReservation.create({
        data: {
          orderId,
          productId,
          qty,
          remainingQty: qty,
          status: "ACTIVE",
        },
      });
    });
  }

  // ==========================================
  // RELEASE STOCK
  // Hanya melepas reservasi milik orderId terkait.
  // Mendukung pelepasan sebagian.
  // ==========================================

  async release(params: ReleaseStockParams): Promise<void> {
    const { productId, qty, orderId } = params;

    assertPositiveQuantity(qty, "Jumlah pelepasan reservasi");

    await this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);

      const product = await lockProduct(tx, productId);

      const reservations = await tx.stockReservation.findMany({
        where: {
          orderId,
          productId,
          status: "ACTIVE",
          remainingQty: { gt: 0 },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const totalReserved = reservations.reduce(
        (total, reservation) => total + reservation.remainingQty,
        0
      );

      if (totalReserved < qty) {
        throw new Error(
          `Reservasi pesanan ${orderId} tidak cukup. Tersedia untuk dilepas: ${totalReserved}, diminta: ${qty}`
        );
      }

      if (product.reservedStock < qty) {
        throw new Error(
          `Data stok tercadangkan tidak konsisten untuk barang ${product.name}`
        );
      }

      let remainingToRelease = qty;

      for (const reservation of reservations) {
        if (remainingToRelease <= 0) break;

        const releaseQty = Math.min(
          reservation.remainingQty,
          remainingToRelease
        );

        const newRemainingQty =
          reservation.remainingQty - releaseQty;

        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            remainingQty: newRemainingQty,
            status:
              newRemainingQty === 0 ? "RELEASED" : "ACTIVE",
          },
        });

        remainingToRelease -= releaseQty;
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          reservedStock: product.reservedStock - qty,
        },
      });
    });
  }

  // ==========================================
  // COMMIT RESERVATION
  // Mengurangi stok berdasarkan reservasi pesanan.
  // Semua perubahan berjalan dalam satu transaksi.
  // ==========================================

  async commitReservation(
    { orderId }: CommitReservationParams
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);

      const reservations = await tx.stockReservation.findMany({
        where: {
          orderId,
          status: "ACTIVE",
          remainingQty: { gt: 0 },
        },
        orderBy: {
          productId: "asc",
        },
      });

      // Idempotensi: jika seluruh reservasi sudah committed,
      // pemanggilan ulang tidak mengurangi stok lagi.
      const committedReservations =
        await tx.stockReservation.count({
          where: {
            orderId,
            status: "COMMITTED",
          },
        });

      if (reservations.length === 0) {
        if (committedReservations > 0) {
          return;
        }

        throw new Error(
          `Tidak ada reservasi aktif untuk pesanan ${orderId}`
        );
      }

      if (committedReservations > 0) {
        throw new Error(
          `Status reservasi pesanan ${orderId} tidak konsisten`
        );
      }

      const orderItems = await tx.orderItem.findMany({
        where: { orderId },
        select: {
          productId: true,
          qty: true,
        },
        orderBy: {
          productId: "asc",
        },
      });

      if (orderItems.length === 0) {
        throw new Error(
          `Pesanan ${orderId} tidak memiliki barang`
        );
      }

      // Gabungkan jumlah item pesanan per produk.
      const orderQuantities = new Map<string, number>();

      for (const item of orderItems) {
        assertPositiveQuantity(item.qty, "Jumlah barang pesanan");

        orderQuantities.set(
          item.productId,
          (orderQuantities.get(item.productId) ?? 0) + item.qty
        );
      }

      // Gabungkan jumlah reservasi aktif per produk.
      const reservationQuantities = new Map<string, number>();

      for (const reservation of reservations) {
        reservationQuantities.set(
          reservation.productId,
          (reservationQuantities.get(reservation.productId) ?? 0) +
            reservation.remainingQty
        );
      }

      // Reservasi harus sama persis dengan jumlah pesanan.
      if (orderQuantities.size !== reservationQuantities.size) {
        throw new Error(
          `Jumlah reservasi tidak sesuai dengan item pesanan ${orderId}`
        );
      }

      // PERBAIKAN: menggunakan forEach agar kompatibel
      // dengan konfigurasi target TypeScript project.
      orderQuantities.forEach((orderQty, productId) => {
        const reservedQty =
          reservationQuantities.get(productId) ?? 0;

        if (reservedQty !== orderQty) {
          throw new Error(
            `Reservasi barang ${productId} tidak sesuai. Pesanan: ${orderQty}, reservasi: ${reservedQty}`
          );
        }
      });

      const productIds = Array.from(orderQuantities.keys()).sort();

      // Kunci produk berdasarkan urutan ID untuk mengurangi risiko deadlock.
      const products = new Map<
        string,
        Awaited<ReturnType<typeof lockProduct>>
      >();

      for (const productId of productIds) {
        products.set(
          productId,
          await lockProduct(tx, productId)
        );
      }

      // Validasi semua produk sebelum mengubah stok.
      for (const productId of productIds) {
        const product = products.get(productId);
        const qty = orderQuantities.get(productId);

        if (!product || qty === undefined) {
          throw new Error(
            `Data stok barang ${productId} tidak ditemukan`
          );
        }

        const reservedQty =
          reservationQuantities.get(productId) ?? 0;

        if (
          product.stock < qty ||
          product.reservedStock < reservedQty
        ) {
          throw new Error(
            `Stok tidak cukup untuk menyelesaikan pesanan ${orderId} pada barang ${product.name}`
          );
        }
      }

      // Kurangi stok dan buat riwayat pergerakan stok.
      for (const productId of productIds) {
        const product = products.get(productId);
        const qty = orderQuantities.get(productId);

        if (!product || qty === undefined) {
          throw new Error(
            `Data stok barang ${productId} tidak ditemukan`
          );
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

      // Tandai seluruh reservasi pesanan sebagai committed.
      await tx.stockReservation.updateMany({
        where: {
          orderId,
          status: "ACTIVE",
          remainingQty: { gt: 0 },
        },
        data: {
          remainingQty: 0,
          status: "COMMITTED",
        },
      });
    });
  }
}

// ==========================================
// DEFAULT INSTANCE
// ==========================================

export const stockService: IStockService = new StockService();
