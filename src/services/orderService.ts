import { db } from "@/lib/db";
import { OrderStatus, PaymentMethod, PaymentStatus, StockMovementType } from "@prisma/client";

/**
 * Generate formatted unique order number: ORD-YYYYMMDD-XXXX (AC 6.5)
 */
export async function generateOrderNo(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `ORD-${yyyy}${mm}${dd}-`;

  const countToday = await db.order.count({
    where: {
      orderNo: {
        startsWith: prefix,
      },
    },
  });

  const seq = String(countToday + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

export interface CreateOrderItemInput {
  productId: string;
  qty: number;
}

export interface CreateOrderParams {
  memberId: string;
  createdById: string;
  items: CreateOrderItemInput[];
  note?: string;
}

/**
 * Create a new order (status: DIAJUKAN)
 * Validates stock availability (FR-5.4)
 */
export async function createOrder({
  memberId,
  createdById,
  items,
  note,
}: CreateOrderParams) {
  if (!items || items.length === 0) {
    throw new Error("Keranjang belanja tidak boleh kosong");
  }

  return await db.$transaction(async (tx) => {
    // 1. Validate member exists
    const member = await tx.member.findUnique({
      where: { id: memberId },
    });
    if (!member) {
      throw new Error("Data anggota tidak valid");
    }

    // 2. Fetch products and validate stock
    let totalOrder = 0;
    const orderItemsData: { productId: string; qty: number; unitPrice: number }[] = [];

    for (const item of items) {
      if (item.qty <= 0) {
        throw new Error("Jumlah barang harus minimal 1");
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || !product.isActive || product.deletedAt) {
        throw new Error("Produk tidak tersedia atau telah dinonaktifkan");
      }

      // FR-5.4: Jumlah pesanan tidak boleh melebihi stok tersedia saat diajukan
      const availableStock = product.stock - product.reservedStock;
      if (item.qty > availableStock) {
        throw new Error(
          `Pesanan untuk ${product.name} melebihi sisa stok yang tersedia (${availableStock} ${product.unitId || ""})`
        );
      }

      totalOrder += product.sellPrice * item.qty;
      orderItemsData.push({
        productId: product.id,
        qty: item.qty,
        unitPrice: product.sellPrice,
      });
    }

    // 3. Generate unique order number
    const orderNo = await generateOrderNo();

    // 4. Create Order and OrderItems
    const order = await tx.order.create({
      data: {
        orderNo,
        memberId,
        createdById,
        status: OrderStatus.DIAJUKAN,
        note: note?.trim() || null,
        total: totalOrder,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
        member: true,
      },
    });

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        userId: createdById,
        action: "CREATE_ORDER",
        entity: "Order",
        entityId: order.id,
        detailJson: { orderNo, total: totalOrder, itemCount: items.length },
      },
    });

    return order;
  });
}

/**
 * Transition order status according to PRD state machine
 * Handles reservedStock allocation/release and sale creation upon completion
 */
export async function updateOrderStatus({
  orderId,
  newStatus,
  userId,
  rejectReason,
  paymentMethod = PaymentMethod.TUNAI,
  paymentStatus = PaymentStatus.LUNAS,
}: {
  orderId: string;
  newStatus: OrderStatus;
  userId: string;
  rejectReason?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
}) {
  return await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
        member: true,
      },
    });

    if (!order) {
      throw new Error("Pesanan tidak ditemukan");
    }

    const currentStatus = order.status;

    // Terminal statuses cannot transition further
    if (
      currentStatus === OrderStatus.SELESAI ||
      currentStatus === OrderStatus.DIBATALKAN ||
      currentStatus === OrderStatus.DITOLAK
    ) {
      throw new Error(`Pesanan dengan status ${currentStatus} tidak dapat diubah lagi.`);
    }

    // Validate transitions
    if (newStatus === OrderStatus.DIKONFIRMASI) {
      if (currentStatus !== OrderStatus.DIAJUKAN) {
        throw new Error(`Pesanan hanya bisa dikonfirmasi dari status DIAJUKAN`);
      }

      // Reserve stock for all items
      for (const item of order.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Barang ${item.product.name} tidak ditemukan`);

        const available = prod.stock - prod.reservedStock;
        if (available < item.qty) {
          throw new Error(
            `Stok ${prod.name} tidak mencukupi untuk dikonfirmasi. Sisa: ${available}, butuh: ${item.qty}`
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            reservedStock: { increment: item.qty },
          },
        });
      }
    } else if (newStatus === OrderStatus.DISIAPKAN) {
      if (currentStatus !== OrderStatus.DIKONFIRMASI) {
        throw new Error("Pesanan harus dalam status DIKONFIRMASI sebelum DISIAPKAN");
      }
    } else if (newStatus === OrderStatus.SIAP_DIAMBIL) {
      if (currentStatus !== OrderStatus.DISIAPKAN && currentStatus !== OrderStatus.DIKONFIRMASI) {
        throw new Error("Pesanan harus disiapkan terlebih dahulu");
      }
    } else if (newStatus === OrderStatus.SELESAI) {
      if (
        currentStatus !== OrderStatus.SIAP_DIAMBIL &&
        currentStatus !== OrderStatus.DISIAPKAN &&
        currentStatus !== OrderStatus.DIKONFIRMASI
      ) {
        throw new Error("Pesanan belum siap untuk diselesaikan");
      }

      // Generate sale number: SLS-YYYYMMDD-XXXX
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const salePrefix = `SLS-${yyyy}${mm}${dd}-`;
      const countSalesToday = await tx.sale.count({
        where: { saleNo: { startsWith: salePrefix } },
      });
      const saleNo = `${salePrefix}${String(countSalesToday + 1).padStart(4, "0")}`;

      // Deduct actual physical stock and release reservedStock
      const saleItemsCreate = [];
      for (const item of order.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Barang tidak ditemukan`);

        const stockBefore = prod.stock;
        const stockAfter = stockBefore - item.qty;

        if (stockAfter < 0) {
          throw new Error(`Stok ${prod.name} menjadi negatif! Penyesuaian dibatalkan.`);
        }

        // Deduct stock & reservedStock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: stockAfter,
            reservedStock: { decrement: item.qty },
          },
        });

        // Record stock movement (ORDER_FULFILLED)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.ORDER_FULFILLED,
            qtyChange: -item.qty,
            stockBefore,
            stockAfter,
            note: `Penyelesaian pesanan ${order.orderNo}`,
            refType: "ORDER",
            refId: order.id,
            createdById: userId,
          },
        });

        saleItemsCreate.push({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          costPrice: prod.costPrice,
        });
      }

      // Create Sale record
      await tx.sale.create({
        data: {
          saleNo,
          orderId: order.id,
          memberId: order.memberId,
          total: order.total,
          discount: 0,
          paymentMethod,
          paymentStatus,
          createdById: userId,
          items: {
            create: saleItemsCreate,
          },
        },
      });
    } else if (newStatus === OrderStatus.DITOLAK || newStatus === OrderStatus.DIBATALKAN) {
      // If order was already confirmed, release reserved stock
      if (
        currentStatus === OrderStatus.DIKONFIRMASI ||
        currentStatus === OrderStatus.DISIAPKAN ||
        currentStatus === OrderStatus.SIAP_DIAMBIL
      ) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              reservedStock: { decrement: item.qty },
            },
          });
        }
      }

      if (newStatus === OrderStatus.DITOLAK && !rejectReason?.trim()) {
        throw new Error("Alasan penolakan pesanan wajib diisi");
      }
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        rejectReason: rejectReason?.trim() || order.rejectReason,
      },
      include: {
        items: {
          include: { product: true },
        },
        member: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: `ORDER_STATUS_${newStatus}`,
        entity: "Order",
        entityId: order.id,
        detailJson: {
          orderNo: order.orderNo,
          from: currentStatus,
          to: newStatus,
          rejectReason,
        },
      },
    });

    return updated;
  });
}

/**
 * Cancel an order from Member's side (FR-5.3)
 * Only allowed when status is DIAJUKAN
 */
export async function cancelMemberOrder(orderId: string, memberId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Pesanan tidak ditemukan");
  }

  if (order.memberId !== memberId) {
    throw new Error("Anda tidak memiliki hak untuk membatalkan pesanan ini");
  }

  if (order.status !== OrderStatus.DIAJUKAN) {
    throw new Error("Pesanan yang sudah diproses tidak dapat dibatalkan secara mandiri");
  }

  return await updateOrderStatus({
    orderId,
    newStatus: OrderStatus.DIBATALKAN,
    userId,
    rejectReason: "Dibatalkan oleh anggota",
  });
}
