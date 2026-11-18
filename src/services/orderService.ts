import { Prisma, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { stockService } from "@/services/stockService";
import { nextDocumentNumber } from "@/services/documentNumber";
import { resolveSalePaymentFields } from "@/services/paymentFields";
import { auditOrderAction } from "@/services/p4Audit";

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

/** Pesanan tidak ada ATAU bukan milik anggota yang meminta (sengaja tidak dibedakan). */
export class OrderNotFoundError extends OrderError {
  constructor() {
    super("Pesanan tidak ditemukan.");
    this.name = "OrderNotFoundError";
  }
}

type Tx = Prisma.TransactionClient;

type StaffActor = { userId: string };

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

function requireStaffActor(userId: string | undefined): string {
  if (!userId?.trim()) {
    throw new OrderError("Sesi tidak valid. Silakan login ulang.");
  }
  return userId;
}

// Muat pesanan + kunci barisnya agar dua kasir tidak memproses pesanan yang sama bersamaan
async function loadOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });
  if (!order) throw new OrderNotFoundError();
  return order;
}

// Urutkan per barang supaya urutan penguncian selalu sama (mencegah deadlock)
function sortedItems<T extends { productId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.productId.localeCompare(b.productId));
}

async function reserveOrderStock(
  tx: Tx,
  orderId: string,
  items: { productId: string; qty: number }[]
) {
  for (const item of sortedItems(items)) {
    try {
      await stockService.reserve({ productId: item.productId, qty: item.qty, orderId }, tx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mencadangkan stok.";
      throw new OrderError(
        msg.includes("tidak cukup") ? "Stok tidak cukup untuk mengonfirmasi pesanan ini." : msg
      );
    }
  }
}

async function releaseOrderStock(
  tx: Tx,
  orderId: string,
  items: { productId: string; qty: number }[]
) {
  for (const item of sortedItems(items)) {
    try {
      await stockService.release({ productId: item.productId, qty: item.qty, orderId }, tx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal melepas cadangan stok.";
      throw new OrderError(msg);
    }
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

    const orderNo = await nextDocumentNumber(tx, "ORD");
    const order = await tx.order.create({
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

    await auditOrderAction(tx, input.createdBy, "CREATE_ORDER", order.id, {
      orderNo: order.orderNo,
      memberId: input.memberId,
      total: order.total,
      itemCount: order.orderItems.length,
    });

    return order;
  });
}

/** Kasir mengonfirmasi: stok dicadangkan. */
export async function confirmOrder(orderId: string, actor: StaffActor) {
  const userId = requireStaffActor(actor.userId);

  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, "DIKONFIRMASI");
    await reserveOrderStock(tx, orderId, order.orderItems);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "DIKONFIRMASI" },
    });
    await auditOrderAction(tx, userId, "CONFIRM_ORDER", orderId, {
      orderNo: order.orderNo,
      fromStatus: order.status,
      toStatus: "DIKONFIRMASI",
    });
    return updated;
  });
}

/** DIKONFIRMASI -> DISIAPKAN -> SIAP_DIAMBIL */
export async function advanceOrder(
  orderId: string,
  to: "DISIAPKAN" | "SIAP_DIAMBIL",
  actor: StaffActor
) {
  const userId = requireStaffActor(actor.userId);

  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, to);
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await auditOrderAction(tx, userId, "ADVANCE_ORDER", orderId, {
      orderNo: order.orderNo,
      fromStatus: order.status,
      toStatus: to,
    });
    return updated;
  });
}

/** Kasir menolak (alasan wajib). Cadangan dilepas jika sudah dikonfirmasi. */
export async function rejectOrder(orderId: string, reason: string, actor: StaffActor) {
  if (!reason.trim()) throw new OrderError("Alasan penolakan wajib diisi.");
  const userId = requireStaffActor(actor.userId);

  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, "DITOLAK");
    if (order.status === "DIKONFIRMASI") {
      await releaseOrderStock(tx, orderId, order.orderItems);
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "DITOLAK", rejectReason: reason.trim() },
    });
    await auditOrderAction(tx, userId, "REJECT_ORDER", orderId, {
      orderNo: order.orderNo,
      fromStatus: order.status,
      reason: reason.trim(),
    });
    return updated;
  });
}

/**
 * Pembatalan. Jika dipanggil anggota (isi memberId), hanya boleh pesanan miliknya
 * dan hanya saat DIAJUKAN. Kasir/admin: kosongkan memberId, wajib userId.
 */
export async function cancelOrder(
  orderId: string,
  opts: { memberId?: string; userId?: string } = {}
) {
  const isMemberCancel = Boolean(opts.memberId);

  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    if (opts.memberId) {
      if (order.memberId !== opts.memberId) throw new OrderNotFoundError();
      if (order.status !== "DIAJUKAN") {
        throw new OrderError("Pesanan hanya bisa dibatalkan saat masih berstatus DIAJUKAN.");
      }
    } else {
      requireStaffActor(opts.userId);
    }
    assertTransition(order.status, "DIBATALKAN");
    if (order.status === "DIKONFIRMASI") {
      await releaseOrderStock(tx, orderId, order.orderItems);
    }
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: "DIBATALKAN" } });
    await auditOrderAction(tx, opts.userId, "CANCEL_ORDER", orderId, {
      orderNo: order.orderNo,
      fromStatus: order.status,
      cancelledBy: isMemberCancel ? "MEMBER" : "STAFF",
      memberId: opts.memberId ?? null,
    });
    return updated;
  });
}

/**
 * SELESAI: dalam SATU transaksi, commit reservasi (P2), buat sales + sale_items (snapshot harga beli).
 */
export async function completeOrder(
  orderId: string,
  opts: {
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    userId: string;
  }
) {
  const userId = requireStaffActor(opts.userId);
  const { paymentMethod, paymentStatus } = resolveSalePaymentFields(
    opts.paymentMethod,
    opts.paymentStatus
  );

  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    assertTransition(order.status, "SELESAI");

    const existingSale = await tx.sale.findUnique({ where: { orderId }, select: { id: true } });
    if (existingSale) {
      throw new OrderError("Penjualan untuk pesanan ini sudah ada.");
    }

    try {
      await stockService.commitReservation({ orderId, userId }, tx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyelesaikan reservasi stok.";
      throw new OrderError(msg);
    }

    const saleItems: { productId: string; qty: number; unitPrice: number; costPrice: number }[] = [];
    for (const item of sortedItems(order.orderItems)) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, costPrice: true },
      });
      if (!product) throw new OrderError("Barang tidak ditemukan.");
      saleItems.push({
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        costPrice: product.costPrice,
      });
    }

    const saleNo = await nextDocumentNumber(tx, "SLS");
    const sale = await tx.sale.create({
      data: {
        saleNo,
        orderId,
        memberId: order.memberId,
        total: order.total,
        discount: 0,
        paymentMethod,
        paymentStatus,
        createdBy: userId,
        saleItems: { create: saleItems },
      },
    });

    const updated = await tx.order.update({ where: { id: orderId }, data: { status: "SELESAI" } });

    await auditOrderAction(tx, userId, "COMPLETE_ORDER", orderId, {
      orderNo: order.orderNo,
      saleId: sale.id,
      saleNo: sale.saleNo,
      total: order.total,
      paymentMethod,
      paymentStatus,
    });

    return updated;
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
    include: { orderItems: { include: { product: { include: { unit: true } } } } },
  });
  if (!order) throw new OrderNotFoundError();
  return order;
}