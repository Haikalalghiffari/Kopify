import { PrismaClient, StockMovementType } from "@prisma/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { stockService } from "../stockService";
import {
  AdjustStockParams,
  CommitReservationParams,
  ReleaseStockParams,
  ReserveStockParams,
} from "../contracts";

const prisma = new PrismaClient();

const createUser = async (id: string) => {
  return await prisma.user.create({
    data: {
      id,
      email: `${id}@example.com`,
      username: `user-${id}`,
      passwordHash: 'hashed',
    }
  });
};

const createOrder = async (orderId: string) => {
  const member = await prisma.member.create({
    data: { memberNo: `M${Date.now()}`, name: `Member for ${orderId}` },
  });
  return await prisma.order.create({
    data: {
      id: orderId,
      orderNo: `ORD-${Date.now()}`,
      member: { connect: { id: member.id } },
      status: "DIAJUKAN",
    },
  });
};

const createProduct = async (initialStock: number) => {
  const category = await prisma.category.create({ data: { name: `Cat-${Date.now()}` } });
  const unit = await prisma.unit.create({ data: { name: `Unit-${Date.now()}` } });
  return await prisma.product.create({
    data: {
      name: "Test Product",
      sku: `TP-${Date.now()}`,
      stock: initialStock,
      reservedStock: 0,
      minStock: 5,
      costPrice: 800,
      sellPrice: 1000,
      categoryId: category.id,
      unitId: unit.id,
      isActive: true,
    },
  });
};

describe("StockService integration tests", () => {
  beforeEach(async () => {
    await createUser("user-1");
    await createUser("user-2");
  });

  afterEach(async () => {
    await prisma.stockReservation.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.member.deleteMany();
    await prisma.user.deleteMany();
  });

  it("adjustStock adds and subtracts correctly, prevents negative stock", async () => {
    const product = await createProduct(10);
    const incParams: AdjustStockParams = {
      productId: product.id,
      qtyChange: 5,
      type: StockMovementType.PURCHASE,
      refType: "PURCHASE",
      refId: "ref-1",
      note: "Tambah stok",
      userId: "user-1",
    };
    const incResult = await stockService.adjustStock(incParams);
    expect(incResult.stockAfter).toBe(15);

    const decParams: AdjustStockParams = {
      productId: product.id,
      qtyChange: -8,
      type: StockMovementType.ORDER_FULFILLED,
      refType: "ORDER",
      refId: "order-1",
      note: "Kurangi stok",
      userId: "user-1",
    };
    const decResult = await stockService.adjustStock(decParams);
    expect(decResult.stockAfter).toBe(7);

    await expect(
      stockService.adjustStock({ ...incParams, qtyChange: -20 })
    ).rejects.toThrow();
  });

  it("reserve creates reservation and updates reservedStock", async () => {
    const product = await createProduct(20);
    const orderId = "order-123";
    await createOrder(orderId);
    const params: ReserveStockParams = { productId: product.id, qty: 5, orderId };
    await stockService.reserve(params);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.reservedStock).toBe(5);
    const reservation = await prisma.stockReservation.findFirst({
      where: { orderId, productId: product.id },
    });
    expect(reservation).toBeTruthy();
    expect(reservation?.remainingQty).toBe(5);
  });

  it("release releases part of a reservation", async () => {
    const product = await createProduct(20);
    const orderId = "order-456";
    await createOrder(orderId);
    await stockService.reserve({ productId: product.id, qty: 8, orderId });
    const releaseParams: ReleaseStockParams = { productId: product.id, qty: 3, orderId };
    await stockService.release(releaseParams);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.reservedStock).toBe(5);
    const reservations = await prisma.stockReservation.findMany({
      where: { orderId, productId: product.id },
    });
    const totalRemaining = reservations.reduce((sum, r) => sum + r.remainingQty, 0);
    expect(totalRemaining).toBe(5);
  });

  it("commitReservation reduces stock and marks reservations as committed", async () => {
    const product = await createProduct(30);
    const orderId = "order-789";
    await createOrder(orderId);
    // add order items matching reservation quantity
    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderItems: {
          create: [{ productId: product.id, qty: 4, unitPrice: product.sellPrice }],
        },
      },
    });
    await stockService.reserve({ productId: product.id, qty: 4, orderId });
    const commitParams: CommitReservationParams = { orderId, userId: "user-2" };
    await stockService.commitReservation(commitParams);
    const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updatedProduct.stock).toBe(26);
    expect(updatedProduct.reservedStock).toBe(0);
    const reservation = await prisma.stockReservation.findFirst({ where: { orderId } });
    expect(reservation?.status).toBe("COMMITTED");
  });
});
