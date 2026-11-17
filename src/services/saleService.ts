import { db } from "@/lib/db";
import { PaymentMethod, PaymentStatus, StockMovementType } from "@prisma/client";

export interface CreateSaleItemInput {
  productId: string;
  qty: number;
}

export interface CreateDirectSaleParams {
  memberId?: string | null;
  items: CreateSaleItemInput[];
  discount?: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  createdById: string;
}

/**
 * Generate formatted unique sale number: SLS-YYYYMMDD-XXXX
 */
export async function generateSaleNo(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SLS-${yyyy}${mm}${dd}-`;

  const countToday = await db.sale.count({
    where: {
      saleNo: {
        startsWith: prefix,
      },
    },
  });

  const seq = String(countToday + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

/**
 * Process a direct point-of-sale transaction (FR-6.1 & FR-6.2)
 * Atomically deducts stock, records stock movements, and creates sale record.
 */
export async function createDirectSale({
  memberId,
  items,
  discount = 0,
  paymentMethod,
  paymentStatus = PaymentStatus.LUNAS,
  createdById,
}: CreateDirectSaleParams) {
  if (!items || items.length === 0) {
    throw new Error("Daftar belanjaan kasir tidak boleh kosong");
  }

  if (discount < 0) {
    throw new Error("Nominal diskon tidak boleh negatif");
  }

  return await db.$transaction(async (tx) => {
    // 1. Validate member if provided
    if (memberId) {
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) throw new Error("Data anggota tidak valid");
    }

    // 2. Fetch products and validate available physical stock
    let subtotal = 0;
    const saleItemsData: {
      productId: string;
      qty: number;
      unitPrice: number;
      costPrice: number;
    }[] = [];

    for (const item of items) {
      if (item.qty <= 0) {
        throw new Error("Jumlah barang harus minimal 1");
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || !product.isActive || product.deletedAt) {
        throw new Error("Produk tidak ditemukan atau sudah tidak aktif");
      }

      // Available physical stock: product.stock (must be >= qty)
      if (product.stock < item.qty) {
        throw new Error(
          `Stok tidak mencukupi untuk ${product.name}. Tersedia: ${product.stock}, diminta: ${item.qty}`
        );
      }

      subtotal += product.sellPrice * item.qty;

      saleItemsData.push({
        productId: product.id,
        qty: item.qty,
        unitPrice: product.sellPrice,
        costPrice: product.costPrice,
      });
    }

    const grandTotal = Math.max(0, subtotal - discount);
    const saleNo = await generateSaleNo();

    // 3. Create Sale
    const sale = await tx.sale.create({
      data: {
        saleNo,
        memberId: memberId || null,
        total: grandTotal,
        discount,
        paymentMethod,
        paymentStatus,
        createdById,
        items: {
          create: saleItemsData,
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
        createdBy: true,
      },
    });

    // 4. Deduct physical stock and record StockMovement
    for (const item of items) {
      const prod = await tx.product.findUnique({ where: { id: item.productId } });
      if (!prod) continue;

      const stockBefore = prod.stock;
      const stockAfter = stockBefore - item.qty;

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: stockAfter },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: StockMovementType.SALE,
          qtyChange: -item.qty,
          stockBefore,
          stockAfter,
          note: `Penjualan Kasir ${saleNo}`,
          refType: "SALE",
          refId: sale.id,
          createdById,
        },
      });
    }

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        userId: createdById,
        action: "DIRECT_SALE",
        entity: "Sale",
        entityId: sale.id,
        detailJson: {
          saleNo,
          total: grandTotal,
          paymentMethod,
          paymentStatus,
          itemCount: items.length,
        },
      },
    });

    return sale;
  });
}
