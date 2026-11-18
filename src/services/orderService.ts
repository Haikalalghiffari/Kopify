import { Prisma, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

type Tx = Prisma.TransactionClient;

// Alur status yang diizinkan (PRD 6.5)
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DIAJUKAN: ["DIKONFIRMASI", "DIBATALKAN", "DITOLAK"],
  DIKONFIRMASI: ["DISIAPKAN", "DIBATALKAN", "DITOLAK"],
  DISIAPKAN: ["SIAP_DIAMBIL"],
  SIAP_DIAMBIL: ["SELESAI"],
  SELESAI: [],
  DIBATALKAN: [],
  DITOLAK: [],
};

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new OrderError(`Status tidak bisa diubah dari ${from} ke ${to}.`);
  }
}

// Tanggal WIB (UTC+7) format YYYYMMDD untuk nomor pesanan/penjualan
function wibDateStamp(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10).replace(/-/g, "");
}

async function nextNumber(tx: Tx, kind: "ORD" | "SLS"): Promise<string> {
  const prefix = `${kind}-${wibDateStamp()}-`;
  const count =
    kind === "ORD"
      ? await tx.order.count({ where: { orderNo: { startsWith: prefix } } })
      : await tx.sale.count({ where: { saleNo: { startsWith: prefix } } });
  return prefix + String(count + 1).padStart(4, "0");
}

// Muat pesanan + kunci barisnya agar dua kasir tidak memproses pesanan yang sama bersamaan
async function loadOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });
  if (!order) throw new OrderError("Pesanan tidak ditemukan.");
  return order;
}

// Urutkan per barang supaya urutan penguncian selalu sama (mencegah deadlock)
function sortedItems<T extends { productId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.productId.localeCompare(b.productId));
}

// Cadangkan stok: berhasil hanya jika (stock - reserved_stock) >= qty. Satu query atomik.
async function reserveItems(tx: Tx, items: { productId: string; qty: number }[]) {
  for (const item of sortedItems(items)) {
    const affected = await tx.$executeRaw`
      UPDATE products
      SET reserved_stock = reserved_stock + ${item.qty}
      WHERE id = ${item.productId} AND (stock - reserved_stock) >= ${item.qty}`;
    if (affected === 0) {
      throw new OrderError("Stok tidak cukup untuk mengonfirmasi pesanan ini.");
    }
  }
}

async function releaseItems(tx: Tx, items: { productId: string; qty: number }[]) {
  for (const item of sortedItems(items)) {
    await tx.$executeRaw`
      UPDATE products
      SET reserved_stock = reserved_stock - ${item.qty}
      WHERE id = ${item.productId} AND reserved_stock >= ${item.qty}`;
  }
}

/** Anggota/kasir mengajukan pesanan. Stok belum dicadangkan, hanya divalidasi. */
export async function createOrder(input: {
  memberId: string;
  items: { productId: string; qty: number }[];
  note?: string;
  createdBy?: string;
}) {
  const merged = new Map<string, number>();
  for (const it of input.items) {
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      throw new OrderError("Jumlah barang harus bilangan bulat lebih dari 0.");
    }
    merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);
  }
  if (merged.size === 0) throw new OrderError("Keranjang masih kosong.");

  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
       where: { id: { in: Array.from(merged.keys()) }, isActive: true, deletedAt: null },
    });
    if (products.length !== merged.size) {
      throw new OrderError("Ada barang yang tidak tersedia.");
    }

    let total = 0;
    const itemsData = products.map((p) => {
      const qty = merged.get(p.id)!;
      const available = p.stock - p.reservedStock;
      if (available < qty) {
        throw new OrderError(`Stok "${p.name}" tidak cukup (tersedia ${available}).`);
      }
      total += qty * p.sellPrice;
      return { productId: p.id, qty, unitPrice: p.sellPrice };
    });

    const orderNo = await nextNumber(tx, "ORD");
    return tx.order.create({
      data: {
        orderNo,
        memberId: input.memberId,
        note: input.note,
        total,
        createdBy: input.createdBy,
        orderItems: { create: itemsData },
      },
      include: { orderItems: true },
    });
  });
}

/** Kasir mengonfirmasi: stok dicadangkan. */
export async function confirmOrder(orderId: string) {
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, "DIKONFIRMASI");
    await reserveItems(tx, order.orderItems);
    return tx.order.update({ where: { id: orderId }, data: { status: "DIKONFIRMASI" } });
  });
}

/** DIKONFIRMASI -> DISIAPKAN -> SIAP_DIAMBIL */
export async function advanceOrder(orderId: string, to: "DISIAPKAN" | "SIAP_DIAMBIL") {
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, to);
    return tx.order.update({ where: { id: orderId }, data: { status: to } });
  });
}

/** Kasir menolak (alasan wajib). Cadangan dilepas jika sudah dikonfirmasi. */
export async function rejectOrder(orderId: string, reason: string) {
  if (!reason.trim()) throw new OrderError("Alasan penolakan wajib diisi.");
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, "DITOLAK");
    if (order.status === "DIKONFIRMASI") await releaseItems(tx, order.orderItems);
    return tx.order.update({
      where: { id: orderId },
      data: { status: "DITOLAK", rejectReason: reason.trim() },
    });
  });
}

/**
 * Pembatalan. Jika dipanggil anggota (isi memberId), hanya boleh pesanan miliknya
 * dan hanya saat DIAJUKAN. Kasir/admin: kosongkan memberId.
 */
export async function cancelOrder(orderId: string, opts: { memberId?: string } = {}) {
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    if (opts.memberId) {
      if (order.memberId !== opts.memberId) throw new OrderError("Pesanan tidak ditemukan.");
      if (order.status !== "DIAJUKAN") {
        throw new OrderError("Pesanan hanya bisa dibatalkan saat masih berstatus DIAJUKAN.");
      }
    }
    assertTransition(order.status, "DIBATALKAN");
    if (order.status === "DIKONFIRMASI") await releaseItems(tx, order.orderItems);
    return tx.order.update({ where: { id: orderId }, data: { status: "DIBATALKAN" } });
  });
}

/**
 * SELESAI: dalam SATU transaksi, kurangi stok + lepas cadangan, catat pergerakan stok,
 * buat sales + sale_items (snapshot harga beli).
 */
export async function completeOrder(
  orderId: string,
  opts: { paymentMethod?: PaymentMethod; paymentStatus?: PaymentStatus; userId?: string } = {}
) {
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, "SELESAI");

    const saleItems: { productId: string; qty: number; unitPrice: number; costPrice: number }[] = [];

    for (const item of sortedItems(order.orderItems)) {
      const rows = await tx.$queryRaw<{ stock: number; cost_price: number }[]>`
        SELECT stock, cost_price FROM products WHERE id = ${item.productId} FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new OrderError("Barang tidak ditemukan.");

      const affected = await tx.$executeRaw`
        UPDATE products
        SET stock = stock - ${item.qty}, reserved_stock = reserved_stock - ${item.qty}
        WHERE id = ${item.productId} AND stock >= ${item.qty} AND reserved_stock >= ${item.qty}`;
      if (affected === 0) {
        throw new OrderError("Stok atau cadangan tidak mencukupi untuk menyelesaikan pesanan.");
      }

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "ORDER_FULFILLED",
          qtyChange: -item.qty,
          stockBefore: row.stock,
          stockAfter: row.stock - item.qty,
          refType: "ORDER",
          refId: orderId,
          note: `Pesanan ${order.orderNo} selesai`,
          createdBy: opts.userId,
        },
      });

      saleItems.push({
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        costPrice: row.cost_price, // snapshot harga beli
      });
    }

    const saleNo = await nextNumber(tx, "SLS");
    await tx.sale.create({
      data: {
        saleNo,
        orderId,
        memberId: order.memberId,
        total: order.total,
        discount: 0,
        paymentMethod: opts.paymentMethod ?? "TUNAI",
        paymentStatus: opts.paymentStatus ?? "LUNAS",
        createdBy: opts.userId,
        saleItems: { create: saleItems },
      },
    });

    return tx.order.update({ where: { id: orderId }, data: { status: "SELESAI" } });
  });
}

/** Riwayat pesanan milik satu anggota (isolasi data anggota). */
export function listMemberOrders(memberId: string) {
  return db.order.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    include: { orderItems: { include: { product: true } } },
  });
}

/** Satu pesanan milik anggota. Pesanan anggota lain dianggap tidak ada. */
export async function getMemberOrder(orderId: string, memberId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, memberId },
    include: { orderItems: { include: { product: true } } },
  });
  if (!order) throw new OrderError("Pesanan tidak ditemukan.");
  return order;
}