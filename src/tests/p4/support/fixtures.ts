/**
 * Fixture factory + pembersihan TERBATAS untuk test P4.
 *
 * Aturan:
 *  - Semua baris dibuat dengan prefix unik per-run (P4IT-<runId>-...).
 *  - cleanup() hanya menghapus baris yang DICATAT oleh tracker ini (berdasarkan id),
 *    TIDAK PERNAH deleteMany() tanpa filter, sehingga fixture lain di koperasi_test_db aman.
 *  - Modul ini netral framework (tanpa import vitest/playwright).
 */
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  Role,
  StockReservationStatus,
} from "@prisma/client";

let counter = 0;

export function newRunId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export class FixtureTracker {
  readonly runId: string;
  readonly prefix: string;

  private users: string[] = [];
  private members: string[] = [];
  private categories: string[] = [];
  private units: string[] = [];
  private products: string[] = [];
  private orders: string[] = [];
  private sales: string[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    label = "P4IT",
    runId: string = newRunId()
  ) {
    this.runId = runId;
    this.prefix = `${label}-${runId}`;
  }

  uid(kind: string): string {
    return `${this.prefix}-${kind}-${++counter}`;
  }

  // ---------- master data ----------

  async createCategoryAndUnit() {
    const category = await this.prisma.category.create({ data: { name: this.uid("cat") } });
    const unit = await this.prisma.unit.create({ data: { name: this.uid("unit") } });
    this.categories.push(category.id);
    this.units.push(unit.id);
    return { category, unit };
  }

  async createProduct(opts: {
    stock: number;
    reservedStock?: number;
    costPrice?: number;
    sellPrice?: number;
    name?: string;
    sku?: string;
    categoryId?: string;
    unitId?: string;
    isActive?: boolean;
  }) {
    let { categoryId, unitId } = opts;
    if (!categoryId || !unitId) {
      const cu = await this.createCategoryAndUnit();
      categoryId = categoryId ?? cu.category.id;
      unitId = unitId ?? cu.unit.id;
    }
    const id = this.uid("p");
    const product = await this.prisma.product.create({
      data: {
        name: opts.name ?? `${this.prefix} Produk ${id}`,
        sku: opts.sku ?? `SKU-${id}`,
        stock: opts.stock,
        reservedStock: opts.reservedStock ?? 0,
        costPrice: opts.costPrice ?? 6000,
        sellPrice: opts.sellPrice ?? 10000,
        isActive: opts.isActive ?? true,
        categoryId,
        unitId,
      },
    });
    this.products.push(product.id);
    return product;
  }

  async createMember(status: "AKTIF" | "NONAKTIF" = "AKTIF") {
    const id = this.uid("m");
    const member = await this.prisma.member.create({
      data: { memberNo: `ANG-${id}`, name: `Member ${id}`, status },
    });
    this.members.push(member.id);
    return member;
  }

  async createUser(opts: { role: Role; memberId?: string; passwordHash?: string; password?: string }) {
    const id = this.uid("u");
    const user = await this.prisma.user.create({
      data: {
        username: id.toLowerCase(),
        email: `${id.toLowerCase()}@example.test`,
        passwordHash: opts.passwordHash ?? "not-a-real-hash",
        role: opts.role,
        memberId: opts.memberId,
      },
    });
    this.users.push(user.id);
    return user;
  }

  // ---------- baris bisnis dibuat langsung (melewati service) ----------

  /** Membuat pesanan langsung di DB (untuk skenario yang tidak bisa dibuat lewat createOrder). */
  async createOrderRow(opts: {
    memberId: string;
    status?: OrderStatus;
    items: { productId: string; qty: number; unitPrice?: number }[];
    createdBy?: string;
  }) {
    const id = this.uid("o");
    const itemsData = [];
    let total = 0;
    for (const it of opts.items) {
      const product = await this.prisma.product.findUniqueOrThrow({ where: { id: it.productId } });
      const unitPrice = it.unitPrice ?? product.sellPrice;
      total += unitPrice * it.qty;
      itemsData.push({ productId: it.productId, qty: it.qty, unitPrice });
    }
    const order = await this.prisma.order.create({
      data: {
        // Prefix sengaja bukan ORD-YYYYMMDD- agar tidak mengganggu penomoran harian milik test lain.
        orderNo: `TEST-${id}`,
        memberId: opts.memberId,
        status: opts.status ?? "DIAJUKAN",
        total,
        createdBy: opts.createdBy,
        orderItems: { create: itemsData },
      },
      include: { orderItems: true },
    });
    this.orders.push(order.id);
    return order;
  }

  async createSaleRow(opts: {
    saleNo?: string;
    memberId?: string | null;
    createdBy?: string;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
  }) {
    const sale = await this.prisma.sale.create({
      data: {
        saleNo: opts.saleNo ?? `TEST-${this.uid("s")}`,
        memberId: opts.memberId ?? null,
        createdBy: opts.createdBy,
        total: 0,
        paymentMethod: opts.paymentMethod ?? "TUNAI",
        paymentStatus: opts.paymentStatus ?? "LUNAS",
      },
    });
    this.sales.push(sale.id);
    return sale;
  }

  // ---------- pelacakan hasil yang dibuat service ----------

  trackOrder(id: string) {
    if (!this.orders.includes(id)) this.orders.push(id);
  }
  trackSale(id: string) {
    if (!this.sales.includes(id)) this.sales.push(id);
  }

  // ---------- pembacaan state untuk asersi ----------

  async stock(productId: string) {
    const p = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stock: true, reservedStock: true },
    });
    return p;
  }

  reservations(orderId: string, productId?: string) {
    return this.prisma.stockReservation.findMany({
      where: { orderId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: "asc" },
    });
  }

  countReservations(orderId: string, status: StockReservationStatus) {
    return this.prisma.stockReservation.count({ where: { orderId, status } });
  }

  movements(productId: string) {
    return this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "asc" },
    });
  }

  audits(entity: "Order" | "Sale" | "Product", entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: "asc" },
    });
  }

  salesOfOrder(orderId: string) {
    return this.prisma.sale.findMany({ where: { orderId }, include: { saleItems: true } });
  }

  salesCreatedBy(userId: string) {
    return this.prisma.sale.findMany({
      where: { createdBy: userId },
      include: { saleItems: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Invarian inventaris: 0 <= reservedStock <= stock untuk semua produk milik tracker ini. */
  async assertInventoryInvariant(): Promise<void> {
    const rows = await this.prisma.product.findMany({
      where: { id: { in: this.products } },
      select: { id: true, stock: true, reservedStock: true },
    });
    for (const r of rows) {
      if (r.stock < 0 || r.reservedStock < 0 || r.reservedStock > r.stock) {
        throw new Error(
          `Invarian stok dilanggar untuk ${r.id}: stock=${r.stock}, reservedStock=${r.reservedStock}`
        );
      }
    }
  }

  // ---------- pembersihan terbatas ----------

  async cleanup(): Promise<void> {
    const p = this.prisma;
    const users = [...this.users];
    const members = [...this.members];
    const products = [...this.products];

    // Pesanan/penjualan turunan (dibuat service) ditemukan lewat kepemilikan fixture.
    const orderRows = await p.order.findMany({
      where: { OR: [{ id: { in: this.orders } }, { memberId: { in: members } }] },
      select: { id: true },
    });
    const orderIds = orderRows.map((o) => o.id);

    const saleRows = await p.sale.findMany({
      where: {
        OR: [
          { id: { in: this.sales } },
          { orderId: { in: orderIds } },
          { createdBy: { in: users } },
          { memberId: { in: members } },
        ],
      },
      select: { id: true },
    });
    const saleIds = saleRows.map((s) => s.id);

    await p.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: users } },
          { entityId: { in: [...orderIds, ...saleIds, ...products] } },
        ],
      },
    });
    await p.sale.deleteMany({ where: { id: { in: saleIds } } }); // sale_items cascade
    await p.order.deleteMany({ where: { id: { in: orderIds } } }); // order_items & reservations cascade
    await p.product.deleteMany({ where: { id: { in: products } } }); // movements cascade
    await p.category.deleteMany({ where: { id: { in: this.categories } } });
    await p.unit.deleteMany({ where: { id: { in: this.units } } });
    await p.user.deleteMany({ where: { id: { in: users } } });
    await p.member.deleteMany({ where: { id: { in: members } } });

    this.users = [];
    this.members = [];
    this.categories = [];
    this.units = [];
    this.products = [];
    this.orders = [];
    this.sales = [];
  }
}

/** Urutan id seperti yang dipakai service (agar skenario kegagalan deterministik). */
export function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}
