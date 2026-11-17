import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Mulai seed database Kopify...");

  // Kategori sesuai Grocery Dribbble
  const categories = await Promise.all([
    db.category.upsert({ where: { name: "Sayuran" }, update: {}, create: { name: "Sayuran" } }),
    db.category.upsert({ where: { name: "Buah-buahan" }, update: {}, create: { name: "Buah-buahan" } }),
    db.category.upsert({ where: { name: "Sembako" }, update: {}, create: { name: "Sembako" } }),
    db.category.upsert({ where: { name: "Daging & Unggas" }, update: {}, create: { name: "Daging & Unggas" } }),
    db.category.upsert({ where: { name: "Makanan & Minuman" }, update: {}, create: { name: "Makanan & Minuman" } }),
    db.category.upsert({ where: { name: "Susu & Olahan" }, update: {}, create: { name: "Susu & Olahan" } }),
    db.category.upsert({ where: { name: "Kebersihan & Rumah" }, update: {}, create: { name: "Kebersihan & Rumah" } }),
  ]);

  // Satuan
  const units = await Promise.all([
    db.unit.upsert({ where: { name: "500 gm" }, update: {}, create: { name: "500 gm" } }),
    db.unit.upsert({ where: { name: "kg" }, update: {}, create: { name: "kg" } }),
    db.unit.upsert({ where: { name: "liter" }, update: {}, create: { name: "liter" } }),
    db.unit.upsert({ where: { name: "pcs" }, update: {}, create: { name: "pcs" } }),
    db.unit.upsert({ where: { name: "pack" }, update: {}, create: { name: "pack" } }),
    db.unit.upsert({ where: { name: "botol" }, update: {}, create: { name: "botol" } }),
  ]);

  const catMap = Object.fromEntries(categories.map((c: any) => [c.name, c.id]));
  const unitMap = Object.fromEntries(units.map((u: any) => [u.name, u.id]));

  // Produk real dengan stok terukur
  const productsData = [
    // Sayuran
    { sku: "VGT-001", name: "Beetroot Segar", categoryId: catMap["Sayuran"], unitId: unitMap["500 gm"], costPrice: 14000, sellPrice: 17500, stock: 45, minStock: 10 },
    { sku: "VGT-002", name: "Wortel Manis Lokal (Deshi Gajor)", categoryId: catMap["Sayuran"], unitId: unitMap["500 gm"], costPrice: 15000, sellPrice: 19500, stock: 30, minStock: 10 },
    { sku: "VGT-003", name: "Timun Segar (Deshi Shosha)", categoryId: catMap["Sayuran"], unitId: unitMap["500 gm"], costPrice: 3000, sellPrice: 4500, stock: 25, minStock: 5 },
    { sku: "VGT-004", name: "Kubis / Kol Bulat (Badhakopi)", categoryId: catMap["Sayuran"], unitId: unitMap["500 gm"], costPrice: 7000, sellPrice: 9500, stock: 18, minStock: 5 },
    { sku: "VGT-005", name: "Brokoli Hijau Organik", categoryId: catMap["Sayuran"], unitId: unitMap["500 gm"], costPrice: 18000, sellPrice: 22000, stock: 12, minStock: 5 },

    // Buah-buahan
    { sku: "FRT-001", name: "Alpukat Mentega (Italian Avocado)", categoryId: catMap["Buah-buahan"], unitId: unitMap["500 gm"], costPrice: 9500, sellPrice: 12500, stock: 22, minStock: 5 },
    { sku: "FRT-002", name: "Pisang Cavendish Manis", categoryId: catMap["Buah-buahan"], unitId: unitMap["kg"], costPrice: 18000, sellPrice: 22500, stock: 15, minStock: 5 },

    // Sembako
    { sku: "SMB-001", name: "Beras Premium Pulen 5kg", categoryId: catMap["Sembako"], unitId: unitMap["pack"], costPrice: 65000, sellPrice: 72000, stock: 50, minStock: 15 },
    { sku: "SMB-002", name: "Minyak Goreng Sawit 1L", categoryId: catMap["Sembako"], unitId: unitMap["liter"], costPrice: 15000, sellPrice: 17500, stock: 8, minStock: 10 },
    { sku: "SMB-003", name: "Gula Pasir Kristal Putih 1kg", categoryId: catMap["Sembako"], unitId: unitMap["kg"], costPrice: 14500, sellPrice: 16500, stock: 35, minStock: 10 },
    { sku: "SMB-004", name: "Telur Ayam Negeri 1kg (Isi 16)", categoryId: catMap["Sembako"], unitId: unitMap["kg"], costPrice: 26000, sellPrice: 29000, stock: 20, minStock: 8 },

    // Daging & Unggas
    { sku: "MT-001", name: "Daging Sapi Potong (Beef Mixed Cut Bone)", categoryId: catMap["Daging & Unggas"], unitId: unitMap["500 gm"], costPrice: 55000, sellPrice: 65000, stock: 14, minStock: 5 },
    { sku: "MT-002", name: "Daging Ayam Broiler Halal Segar", categoryId: catMap["Daging & Unggas"], unitId: unitMap["kg"], costPrice: 32000, sellPrice: 38000, stock: 16, minStock: 5 },
    { sku: "MT-003", name: "Daging Sapi Has Dalam (Boneless Meat)", categoryId: catMap["Daging & Unggas"], unitId: unitMap["500 gm"], costPrice: 68000, sellPrice: 78000, stock: 0, minStock: 5 }, // Habis untuk test

    // Makanan & Minuman
    { sku: "MKN-001", name: "Indomie Goreng Spesial", categoryId: catMap["Makanan & Minuman"], unitId: unitMap["pcs"], costPrice: 2800, sellPrice: 3500, stock: 120, minStock: 25 },
    { sku: "MKN-002", name: "Keripik Kentang Renyah (Lays Chips)", categoryId: catMap["Makanan & Minuman"], unitId: unitMap["pack"], costPrice: 17500, sellPrice: 21500, stock: 24, minStock: 8 },
    { sku: "DRK-001", name: "Minuman Soda Kaleng Dingin (Sprite)", categoryId: catMap["Makanan & Minuman"], unitId: unitMap["botol"], costPrice: 5500, sellPrice: 7500, stock: 40, minStock: 12 },
    { sku: "DRK-002", name: "Aqua Air Mineral Botol 600ml", categoryId: catMap["Makanan & Minuman"], unitId: unitMap["botol"], costPrice: 2500, sellPrice: 3500, stock: 65, minStock: 15 },

    // Susu & Olahan
    { sku: "MLK-001", name: "Susu Sapi Segar Pasteurised 1L", categoryId: catMap["Susu & Olahan"], unitId: unitMap["liter"], costPrice: 19000, sellPrice: 24000, stock: 15, minStock: 5 },

    // Kebersihan
    { sku: "KBR-001", name: "Sabun Mandi Lifebuoy Total 10", categoryId: catMap["Kebersihan & Rumah"], unitId: unitMap["pcs"], costPrice: 3500, sellPrice: 4500, stock: 80, minStock: 15 },
  ];

  for (const p of productsData) {
    await db.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        categoryId: p.categoryId,
        unitId: p.unitId,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        stock: p.stock,
        minStock: p.minStock,
      },
      create: p,
    });
  }

  console.log(`✅ ${productsData.length} produk tersimpan di database dengan stok riil.`);

  // Anggota
  const members = await Promise.all([
    db.member.upsert({
      where: { memberNo: "ANG-0001" }, update: {},
      create: { memberNo: "ANG-0001", name: "Budi Santoso", phone: "08123456789", email: "budi@example.com", address: "Jl. Merdeka No. 1, Jakarta" },
    }),
    db.member.upsert({
      where: { memberNo: "ANG-0002" }, update: {},
      create: { memberNo: "ANG-0002", name: "Siti Rahayu", phone: "08987654321", email: "siti@example.com", address: "Jl. Sudirman No. 5, Jakarta" },
    }),
  ]);

  // Akun Admin, Kasir, Anggota
  const adminHash = await bcrypt.hash("admin123", 12);
  await db.user.upsert({
    where: { email: "admin@koperasi.id" }, update: {},
    create: { username: "admin", email: "admin@koperasi.id", passwordHash: adminHash, role: "ADMIN" },
  });

  const kasirHash = await bcrypt.hash("kasir123", 12);
  await db.user.upsert({
    where: { email: "kasir@koperasi.id" }, update: {},
    create: { username: "kasir", email: "kasir@koperasi.id", passwordHash: kasirHash, role: "KASIR" },
  });

  const anggotaHash = await bcrypt.hash("anggota123", 12);
  await db.user.upsert({
    where: { email: "budi@example.com" }, update: {},
    create: { username: "budi", email: "budi@example.com", passwordHash: anggotaHash, role: "ANGGOTA", memberId: members[0].id },
  });

  console.log("\n🎉 Seed Kopify selesai!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
