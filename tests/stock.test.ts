import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { executeStockMovement, restockProduct, adjustStock } from "../src/services/stockService";

const db = new PrismaClient();

describe("AC 6.4 - Manajemen & Audit Stok", () => {
  let testProduct: any;
  let adminUser: any;

  beforeAll(async () => {
    await db.$connect();

    adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });

    const category = await db.category.findFirst();
    const unit = await db.unit.findFirst();

    testProduct = await db.product.create({
      data: {
        sku: "TEST-STOCK-SKU-01",
        name: "Test Barang Stok",
        categoryId: category!.id,
        unitId: unit!.id,
        costPrice: 10000,
        sellPrice: 12000,
        stock: 20,
        minStock: 5,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await db.stockMovement.deleteMany({ where: { productId: testProduct.id } });
      await db.product.delete({ where: { id: testProduct.id } });
    }
    await db.$disconnect();
  });

  it("mencatat mutasi barang masuk (restock) dan menambah stok fisik", async () => {
    const qtyToAdd = 15;
    const initialStock = testProduct.stock;

    const { movement, product } = await restockProduct({
      productId: testProduct.id,
      qty: qtyToAdd,
      note: "Restock uji coba supplier",
      userId: adminUser.id,
    });

    expect(movement.type).toBe("PURCHASE");
    expect(movement.qtyChange).toBe(qtyToAdd);
    expect(movement.stockBefore).toBe(initialStock);
    expect(movement.stockAfter).toBe(initialStock + qtyToAdd);
    expect(product.stock).toBe(initialStock + qtyToAdd);

    testProduct.stock = product.stock;
  });

  it("FR-4.4: menolak mutasi yang menyebabkan stok negatif dan melempar error", async () => {
    // Current stock is 35, try to deduct 50
    await expect(
      executeStockMovement({
        productId: testProduct.id,
        type: "SALE",
        qtyChange: -50,
        note: "Pengurangan melebihi stok",
        userId: adminUser.id,
      })
    ).rejects.toThrow("Stok tidak mencukupi");

    // Pastikan stok tidak berubah di database
    const current = await db.product.findUnique({ where: { id: testProduct.id } });
    expect(current?.stock).toBe(testProduct.stock);
  });

  it("FR-4.2: opname fisik dengan alasan wajib mencatat selisih", async () => {
    // Alasan kosong harus ditolak
    await expect(
      adjustStock({
        productId: testProduct.id,
        actualPhysicalStock: 30,
        reason: "",
        userId: adminUser.id,
      })
    ).rejects.toThrow("Alasan penyesuaian stok fisik wajib diisi");

    // Opname sah
    const { movement, product } = await adjustStock({
      productId: testProduct.id,
      actualPhysicalStock: 30,
      reason: "Hasil hitung opname bulanan",
      userId: adminUser.id,
    });

    expect(movement.type).toBe("ADJUSTMENT");
    expect(movement.stockAfter).toBe(30);
    expect(product.stock).toBe(30);
    expect(movement.note).toContain("Opname Fisik");
  });
});
