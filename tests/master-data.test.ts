import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

describe("AC 6.2 - Master Data Management", () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("prevents duplicate member numbers (unique constraint)", async () => {
    const uniqueNo = "TEST-ANG-9999";

    // Clean up if exists
    await db.member.deleteMany({ where: { memberNo: uniqueNo } });

    await db.member.create({
      data: {
        memberNo: uniqueNo,
        name: "Test Anggota 1",
      },
    });

    // Second insert with same memberNo should fail
    await expect(
      db.member.create({
        data: {
          memberNo: uniqueNo,
          name: "Test Anggota 2",
        },
      })
    ).rejects.toThrow();

    // Clean up
    await db.member.deleteMany({ where: { memberNo: uniqueNo } });
  });

  it("prevents duplicate SKU for products (unique constraint)", async () => {
    const testSku = "TEST-SKU-9999";
    const category = await db.category.findFirst();
    const unit = await db.unit.findFirst();

    if (!category || !unit) return;

    // Clean up if exists
    await db.product.deleteMany({ where: { sku: testSku } });

    await db.product.create({
      data: {
        sku: testSku,
        name: "Test Produk 1",
        categoryId: category.id,
        unitId: unit.id,
        costPrice: 5000,
        sellPrice: 7000,
        stock: 10,
      },
    });

    // Second insert with same SKU should fail
    await expect(
      db.product.create({
        data: {
          sku: testSku,
          name: "Test Produk 2",
          categoryId: category.id,
          unitId: unit.id,
          costPrice: 5000,
          sellPrice: 7000,
          stock: 10,
        },
      })
    ).rejects.toThrow();

    // Clean up
    await db.product.deleteMany({ where: { sku: testSku } });
  });

  it("supports soft delete with deletedAt timestamp", async () => {
    const member = await db.member.create({
      data: {
        memberNo: "SOFT-DEL-01",
        name: "Anggota Soft Delete",
      },
    });

    // Soft delete
    const softDeleted = await db.member.update({
      where: { id: member.id },
      data: { deletedAt: new Date(), status: "NONAKTIF" },
    });

    expect(softDeleted.deletedAt).not.toBeNull();
    expect(softDeleted.status).toBe("NONAKTIF");

    // Clean up
    await db.member.delete({ where: { id: member.id } });
  });
});
