import { Prisma, PaymentMethod, PaymentStatus, StockMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { stockService } from "@/services/stockService";
import { nextDocumentNumber } from "@/services/documentNumber";
import { resolveSalePaymentFields } from "@/services/paymentFields";
import { auditSaleAction } from "@/services/p4Audit";

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleError";
  }
}

function requireActorId(userId: string | undefined): string {
  if (!userId?.trim()) {
    throw new SaleError("Sesi tidak valid. Silakan login ulang.");
  }
  return userId;
}

export type CreateSaleInput = {
  items: { productId: string; qty: number }[];
  memberId?: string | null; // kosong = pembeli umum
  discount?: number; // rupiah integer
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  createdBy?: string;
};

/**
 * Penjualan langsung (PRD 6.6). Satu transaksi:
 * kunci barang, cek stok, kurangi stok, catat stock_movements (SALE),
 * simpan sales + sale_items (snapshot harga beli).
 * Harga jual selalu diambil dari database, bukan dari klien.
 */
export async function createSale(input: CreateSaleInput) {
  const actorId = requireActorId(input.createdBy);

  const merged = new Map<string, number>();
  for (const it of input.items) {
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      throw new SaleError("Jumlah barang harus bilangan bulat lebih dari 0.");
    }
    merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);
  }
  if (merged.size === 0) throw new SaleError("Keranjang kasir masih kosong.");

  const discount = input.discount ?? 0;
  if (!Number.isInteger(discount) || discount < 0) {
    throw new SaleError("Diskon harus bilangan bulat rupiah, minimal 0.");
  }

  const { paymentMethod, paymentStatus } = resolveSalePaymentFields(
    input.paymentMethod,
    input.paymentStatus
  );

  if (paymentMethod === "BON" && !input.memberId) {
    throw new SaleError("Pembayaran BON hanya untuk anggota. Pilih anggota dulu.");
  }

  return db.$transaction(async (tx) => {
    if (input.memberId) {
      const member = await tx.member.findFirst({
        where: { id: input.memberId, deletedAt: null, status: "AKTIF" },
        select: { id: true },
      });
      if (!member) throw new SaleError("Anggota tidak ditemukan atau tidak aktif.");
    }

    // Urutan tetap supaya tidak deadlock
    const productIds = Array.from(merged.keys()).sort();

    let subtotal = 0;
    const saleItems: { productId: string; qty: number; unitPrice: number; costPrice: number }[] = [];

    for (const productId of productIds) {
      const qty = merged.get(productId)!;

      const rows = await tx.$queryRaw<
        {
          name: string;
          stock: number;
          reserved_stock: number;
          cost_price: number;
          sell_price: number;
          is_active: boolean;
          deleted_at: Date | null;
        }[]
      >`SELECT name, stock, reserved_stock, cost_price, sell_price, is_active, deleted_at
        FROM products WHERE id = ${productId} FOR UPDATE`;

      const p = rows[0];
      if (!p || !p.is_active || p.deleted_at) {
        throw new SaleError("Ada barang yang tidak tersedia.");
      }

      // Stok yang sudah dicadangkan pesanan anggota tidak boleh dijual
      const available = p.stock - p.reserved_stock;
      if (available < qty) {
        throw new SaleError(`Stok "${p.name}" tidak cukup (tersedia ${available}).`);
      }

      subtotal += qty * p.sell_price;
      saleItems.push({
        productId,
        qty,
        unitPrice: p.sell_price,
        costPrice: p.cost_price, // snapshot harga beli
      });
    }

    if (discount > subtotal) {
      throw new SaleError("Diskon tidak boleh lebih besar dari total belanja.");
    }

    const saleNo = await nextDocumentNumber(tx, "SLS");
    const sale = await tx.sale.create({
      data: {
        saleNo,
        memberId: input.memberId ?? null,
        total: subtotal - discount, // total bersih setelah diskon
        discount,
        paymentMethod,
        paymentStatus,
        createdBy: actorId,
        saleItems: { create: saleItems },
      },
      include: { saleItems: true },
    });

    for (const item of saleItems) {
      try {
        await stockService.adjustStock(
          {
            productId: item.productId,
            qtyChange: -item.qty,
            type: StockMovementType.SALE,
            refType: "SALE",
            refId: sale.id,
            note: `Penjualan ${saleNo}`,
            userId: actorId,
          },
          tx
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gagal menyesuaikan stok.";
        throw new SaleError(
          msg.includes("tidak cukup") ? `Stok tidak cukup untuk barang ini.` : msg
        );
      }
    }

    await auditSaleAction(tx, actorId, "CREATE_SALE", sale.id, {
      saleNo: sale.saleNo,
      total: sale.total,
      discount,
      paymentMethod,
      paymentStatus,
      memberId: sale.memberId,
      itemCount: saleItems.length,
    });

    return sale;
  });
}