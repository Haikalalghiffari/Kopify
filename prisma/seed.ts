import { PrismaClient, Role, MemberStatus, StockMovementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seeding database Sistem Informasi Koperasi...");

  // 1. Bersihkan data development (urutan sesuai foreign key constraint)
  await prisma.auditLog.deleteMany();
  await prisma.importLog.deleteMany();
  await prisma.importTemplate.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.member.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.category.deleteMany();
  await prisma.unit.deleteMany();

  console.log("🧹 Data lama berhasil dibersihkan.");

  // 2. Seed Master Satuan
  const units = await Promise.all([
    prisma.unit.create({ data: { name: "Pcs" } }),
    prisma.unit.create({ data: { name: "Kg" } }),
    prisma.unit.create({ data: { name: "Liter" } }),
    prisma.unit.create({ data: { name: "Pack" } }),
    prisma.unit.create({ data: { name: "Dus" } }),
    prisma.unit.create({ data: { name: "Botol" } }),
  ]);
  const unitMap = new Map(units.map((u) => [u.name, u.id]));
  console.log(`✅ ${units.length} Satuan berhasil dibuat.`);

  // 3. Seed Master Kategori
  const categories = await Promise.all([
    prisma.category.create({ data: { name: "Sembako" } }),
    prisma.category.create({ data: { name: "Minuman" } }),
    prisma.category.create({ data: { name: "Makanan Ringan" } }),
    prisma.category.create({ data: { name: "Alat Tulis" } }),
    prisma.category.create({ data: { name: "Perlengkapan Rumah" } }),
  ]);
  const catMap = new Map(categories.map((c) => [c.name, c.id]));
  console.log(`✅ ${categories.length} Kategori berhasil dibuat.`);

  // 4. Seed Pemasok
  await Promise.all([
    prisma.supplier.create({
      data: {
        name: "PT Sumber Makmur Sejahtera",
        phone: "081234567890",
        address: "Kawasan Industri Pulo Gadung, Jakarta Timur",
      },
    }),
    prisma.supplier.create({
      data: {
        name: "CV Berkah Jaya Abadi",
        phone: "082345678901",
        address: "Jl. Raya Pasar Minggu No. 45, Jakarta Selatan",
      },
    }),
  ]);
  console.log("✅ Pemasok contoh berhasil dibuat.");

  // 5. Seed Akun Admin
  const adminUsername = process.env.ADMIN_INITIAL_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_INITIAL_EMAIL || "admin@koperasi.local";
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || "AdminKoperasi2026!";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      username: adminUsername,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Akun Admin berhasil dibuat (${adminUsername} / ${adminEmail}).`);

  // 6. Seed Akun Kasir
  const kasirPasswordHash = await bcrypt.hash("KasirKoperasi2026!", 10);
  const kasirUser = await prisma.user.create({
    data: {
      username: "kasir",
      email: "kasir@koperasi.local",
      passwordHash: kasirPasswordHash,
      role: Role.KASIR,
      isActive: true,
    },
  });
  console.log("✅ Akun Kasir berhasil dibuat (kasir / kasir@koperasi.local).");

  // 7. Seed Member & Akun Anggota
  const memberData = await prisma.member.create({
    data: {
      memberNo: "ANG-0001",
      name: "Budi Santoso",
      nik: "3171012345670001",
      phone: "081987654321",
      email: "budi.santoso@anggota.local",
      address: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
      status: MemberStatus.AKTIF,
      joinedAt: new Date(),
    },
  });

  const memberPasswordHash = await bcrypt.hash("AnggotaKoperasi2026!", 10);
  await prisma.user.create({
    data: {
      username: "budi",
      email: "budi.santoso@anggota.local",
      passwordHash: memberPasswordHash,
      role: Role.ANGGOTA,
      memberId: memberData.id,
      isActive: true,
    },
  });
  console.log("✅ Data Anggota & Akun Anggota berhasil dibuat (budi / budi.santoso@anggota.local).");

  // 8. Seed Produk Contoh + Pergerakan Stok Awal (Audit Movement)
  const sampleProducts = [
    {
      sku: "BRG-0001",
      name: "Beras Premium Ramos 5kg",
      categoryId: catMap.get("Sembako")!,
      unitId: unitMap.get("Pack")!,
      costPrice: 62000,
      sellPrice: 70000,
      stock: 50,
      minStock: 10,
    },
    {
      sku: "BRG-0002",
      name: "Minyak Goreng Sawit 2 Liter",
      categoryId: catMap.get("Sembako")!,
      unitId: unitMap.get("Botol")!,
      costPrice: 28000,
      sellPrice: 33000,
      stock: 40,
      minStock: 10,
    },
    {
      sku: "BRG-0003",
      name: "Gula Pasir Kristal Putih 1kg",
      categoryId: catMap.get("Sembako")!,
      unitId: unitMap.get("Kg")!,
      costPrice: 14000,
      sellPrice: 16500,
      stock: 35,
      minStock: 5,
    },
    {
      sku: "BRG-0004",
      name: "Kopi Arabika Bubuk 250gr",
      categoryId: catMap.get("Minuman")!,
      unitId: unitMap.get("Pack")!,
      costPrice: 18000,
      sellPrice: 22000,
      stock: 25,
      minStock: 5,
    },
    {
      sku: "BRG-0005",
      name: "Teh Celup Melati Kotak 25s",
      categoryId: catMap.get("Minuman")!,
      unitId: unitMap.get("Dus")!,
      costPrice: 6000,
      sellPrice: 8000,
      stock: 60,
      minStock: 15,
    },
    {
      sku: "BRG-0006",
      name: "Buku Tulis Sinar Dunia 38 Lembar",
      categoryId: catMap.get("Alat Tulis")!,
      unitId: unitMap.get("Pcs")!,
      costPrice: 3500,
      sellPrice: 5000,
      stock: 100,
      minStock: 20,
    },
  ];

  for (const p of sampleProducts) {
    const createdProduct = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        categoryId: p.categoryId,
        unitId: p.unitId,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        stock: p.stock,
        reservedStock: 0,
        minStock: p.minStock,
        isActive: true,
      },
    });

    // Catat stock movement awal sebagai audit trail konsisten
    await prisma.stockMovement.create({
      data: {
        productId: createdProduct.id,
        type: StockMovementType.IMPORT,
        qtyChange: p.stock,
        stockBefore: 0,
        stockAfter: p.stock,
        refType: "SEED_INITIAL_STOCK",
        note: "Stok awal migrasi sistem koperasi",
        createdBy: adminUser.id,
      },
    });
  }
  console.log(`✅ ${sampleProducts.length} Produk contoh & audit stok awal berhasil dibuat.`);

  // 9. Catat Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "DATABASE_INITIAL_SEED",
      entity: "System",
      detailJson: {
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log("🎉 Seeding database selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi error saat seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
