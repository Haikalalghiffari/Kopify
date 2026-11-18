import { Prisma, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleError";
  }
}

type Tx = Prisma.TransactionClient;

function wibDateStamp(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10).replace(/-/g, "");
}

// Nomor SLS-YYYYMMDD-XXXX. Advisory lock mencegah dua kasir mendapat nomor sama.
async function nextSaleNo(tx: Tx): Promise<string> {
  const prefix = `SLS-${wibDateStamp()}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
  const count = await tx.sale.count({ where: { saleNo: { startsWith: prefix } } });
  return prefix + String(count + 1).padStart(4, "0");
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

  const paymentMethod = input.paymentMethod ?? "TUNAI";
  // BON otomatis belum lunas; metode lain lunas kecuali ditentukan
  const paymentStatus: PaymentStatus =
    input.paymentStatus ?? (paymentMethod === "BON" ? "BELUM_LUNAS" : "LUNAS");

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

      const affected = await tx.$executeRaw`
        UPDATE products SET stock = stock - ${qty}
        WHERE id = ${productId} AND (stock - reserved_stock) >= ${qty}`;
      if (affected === 0) {
        throw new SaleError(`Stok "${p.name}" tidak cukup.`);
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

    const saleNo = await nextSaleNo(tx);
    const sale = await tx.sale.create({
      data: {
        saleNo,
        memberId: input.memberId ?? null,
        total: subtotal - discount, // total bersih setelah diskon
        discount,
        paymentMethod,
        paymentStatus,
        createdBy: input.createdBy,
        saleItems: { create: saleItems },
      },
      include: { saleItems: true },
    });

    // Catat pergerakan stok (stok_before diambil dari baris yang sudah dikunci)
    for (const item of saleItems) {
      const after = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
        select: { stock: true },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "SALE",
          qtyChange: -item.qty,
          stockBefore: after.stock + item.qty,
          stockAfter: after.stock,
          refType: "SALE",
          refId: sale.id,
          note: `Penjualan ${saleNo}`,
          createdBy: input.createdBy,
        },
      });
    }

    return sale;
  });
}