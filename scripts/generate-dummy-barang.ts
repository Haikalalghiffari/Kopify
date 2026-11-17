/**
 * scripts/generate-dummy-barang.ts
 * Generate file Excel data dummy barang & stok untuk diimpor ke Kopify.
 * Jalankan: npx tsx scripts/generate-dummy-barang.ts
 */

import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// ─── Data dummy barang & stok ───────────────────────────────────────────────
const barang = [
  // Makanan & Minuman
  { sku: "BRG-FNB-001", name: "Indomie Goreng Original 85g", category: "Makanan & Minuman", unit: "Bungkus", costPrice: 2800, sellPrice: 3500, stock: 120, minStock: 24 },
  { sku: "BRG-FNB-002", name: "Indomie Kuah Ayam Bawang 75g", category: "Makanan & Minuman", unit: "Bungkus", costPrice: 2700, sellPrice: 3500, stock: 96, minStock: 24 },
  { sku: "BRG-FNB-003", name: "Aqua Air Mineral Botol 600ml", category: "Makanan & Minuman", unit: "Botol", costPrice: 2500, sellPrice: 3500, stock: 150, minStock: 30 },
  { sku: "BRG-FNB-004", name: "Le Minerale Botol 600ml", category: "Makanan & Minuman", unit: "Botol", costPrice: 2400, sellPrice: 3500, stock: 110, minStock: 25 },
  { sku: "BRG-FNB-005", name: "Teh Botol Sosro Kotak 250ml", category: "Makanan & Minuman", unit: "Kotak", costPrice: 3200, sellPrice: 4500, stock: 80, minStock: 20 },
  { sku: "BRG-FNB-006", name: "Ultra Milk Cokelat 250ml", category: "Makanan & Minuman", unit: "Kotak", costPrice: 5600, sellPrice: 7000, stock: 65, minStock: 15 },
  { sku: "BRG-FNB-007", name: "Kopi Kapal Api Spesial Mix 10x24g", category: "Makanan & Minuman", unit: "Pack", costPrice: 12500, sellPrice: 15500, stock: 45, minStock: 10 },
  { sku: "BRG-FNB-008", name: "Biskuit Roma Kelapa 300g", category: "Makanan & Minuman", unit: "Bungkus", costPrice: 9500, sellPrice: 12000, stock: 40, minStock: 10 },
  { sku: "BRG-FNB-009", name: "Chitato Sapi Panggang 68g", category: "Makanan & Minuman", unit: "Bungkus", costPrice: 9200, sellPrice: 11500, stock: 55, minStock: 15 },
  { sku: "BRG-FNB-010", name: "Oreo Vanilla Sandwich 133g", category: "Makanan & Minuman", unit: "Bungkus", costPrice: 7800, sellPrice: 9500, stock: 50, minStock: 12 },

  // Sembako
  { sku: "BRG-SMB-001", name: "Beras Pandan Wangi Premium 5kg", category: "Sembako", unit: "Sak", costPrice: 68000, sellPrice: 76000, stock: 40, minStock: 10 },
  { sku: "BRG-SMB-002", name: "Beras Setra Ramos 5kg", category: "Sembako", unit: "Sak", costPrice: 64000, sellPrice: 72000, stock: 50, minStock: 10 },
  { sku: "BRG-SMB-003", name: "Minyak Goreng Bimoli Pouch 2L", category: "Sembako", unit: "Pouch", costPrice: 33000, sellPrice: 37500, stock: 60, minStock: 15 },
  { sku: "BRG-SMB-004", name: "Minyak Goreng Sania Pouch 2L", category: "Sembako", unit: "Pouch", costPrice: 32500, sellPrice: 36500, stock: 45, minStock: 12 },
  { sku: "BRG-SMB-005", name: "Gula Pasir Gulaku Tebu 1kg", category: "Sembako", unit: "Kg", costPrice: 15500, sellPrice: 18000, stock: 85, minStock: 20 },
  { sku: "BRG-SMB-006", name: "Tepung Terigu Segitiga Biru 1kg", category: "Sembako", unit: "Bungkus", costPrice: 10500, sellPrice: 12500, stock: 70, minStock: 15 },
  { sku: "BRG-SMB-007", name: "Telur Ayam Negeri Fresh 1kg", category: "Sembako", unit: "Kg", costPrice: 26000, sellPrice: 29500, stock: 35, minStock: 10 },
  { sku: "BRG-SMB-008", name: "Garam Dapur Beryodium 250g", category: "Sembako", unit: "Bungkus", costPrice: 2000, sellPrice: 3000, stock: 90, minStock: 20 },
  { sku: "BRG-SMB-009", name: "Kecap Manis Bango Pouch 520ml", category: "Sembako", unit: "Pouch", costPrice: 20500, sellPrice: 24000, stock: 40, minStock: 10 },
  { sku: "BRG-SMB-010", name: "Susu Kental Manis Frisian Flag 370g", category: "Sembako", unit: "Kaleng", costPrice: 11000, sellPrice: 13500, stock: 55, minStock: 15 },

  // Kebutuhan Rumah Tangga & Kebersihan
  { sku: "BRG-KRT-001", name: "Deterjen Rinso Molto Bubuk 770g", category: "Kebutuhan Rumah Tangga", unit: "Bungkus", costPrice: 21000, sellPrice: 25000, stock: 45, minStock: 10 },
  { sku: "BRG-KRT-002", name: "Deterjen Daia Putih 850g", category: "Kebutuhan Rumah Tangga", unit: "Bungkus", costPrice: 16500, sellPrice: 19500, stock: 50, minStock: 12 },
  { sku: "BRG-KRT-003", name: "Sunlight Pencuci Piring Jeruk Nipis 650ml", category: "Kebutuhan Rumah Tangga", unit: "Pouch", costPrice: 12500, sellPrice: 15000, stock: 65, minStock: 15 },
  { sku: "BRG-KRT-004", name: "Sabun Mandi Lifebuoy Total 10 Bar 110g", category: "Kebutuhan Rumah Tangga", unit: "Pcs", costPrice: 3500, sellPrice: 4800, stock: 100, minStock: 25 },
  { sku: "BRG-KRT-005", name: "Shampoo Pantene Anti Ketombe 160ml", category: "Kebutuhan Rumah Tangga", unit: "Botol", costPrice: 22000, sellPrice: 27000, stock: 35, minStock: 8 },
  { sku: "BRG-KRT-006", name: "Pasta Gigi Pepsodent White 190g", category: "Kebutuhan Rumah Tangga", unit: "Kotak", costPrice: 12000, sellPrice: 15000, stock: 60, minStock: 15 },
  { sku: "BRG-KRT-007", name: "Pembersih Lantai So Klin Lantai Pouch 780ml", category: "Kebutuhan Rumah Tangga", unit: "Pouch", costPrice: 10500, sellPrice: 13000, stock: 40, minStock: 10 },
  { sku: "BRG-KRT-008", name: "Tissue Paseo Elegant 250 Sheets", category: "Kebutuhan Rumah Tangga", unit: "Pack", costPrice: 13500, sellPrice: 16500, stock: 55, minStock: 12 },

  // Alat Tulis & Kantor (ATK)
  { sku: "BRG-ATK-001", name: "Buku Tulis Sinar Dunia 38 Lembar (Isi 10)", category: "Alat Tulis & Kantor", unit: "Pack", costPrice: 32000, sellPrice: 38000, stock: 30, minStock: 8 },
  { sku: "BRG-ATK-002", name: "Pulpen Standard AE7 Hitam 0.5mm", category: "Alat Tulis & Kantor", unit: "Pcs", costPrice: 2200, sellPrice: 3500, stock: 180, minStock: 30 },
  { sku: "BRG-ATK-003", name: "Kertas HVS PaperOne A4 75g (500 lbr)", category: "Alat Tulis & Kantor", unit: "Rim", costPrice: 48000, sellPrice: 55000, stock: 25, minStock: 5 },
  { sku: "BRG-ATK-004", name: "Map Kertas Stopmap Folio Buffalo", category: "Alat Tulis & Kantor", unit: "Pcs", costPrice: 2000, sellPrice: 3000, stock: 120, minStock: 25 },
  { sku: "BRG-ATK-005", name: "Penghapus Kenko Box Besar", category: "Alat Tulis & Kantor", unit: "Pcs", costPrice: 1800, sellPrice: 3000, stock: 75, minStock: 15 },
];

async function generate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kopify — Sistem Informasi Koperasi";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Data Barang");

  // ── Column definitions ──
  ws.columns = [
    { header: "SKU / Kode Barang", key: "sku",       width: 18 },
    { header: "Nama Barang",       key: "name",      width: 42 },
    { header: "Kategori",          key: "category",  width: 25 },
    { header: "Satuan",            key: "unit",      width: 14 },
    { header: "Harga Beli (Rp)",   key: "costPrice", width: 18 },
    { header: "Harga Jual (Rp)",   key: "sellPrice", width: 18 },
    { header: "Stok Awal",         key: "stock",     width: 14 },
    { header: "Batas Min. Stok",   key: "minStock",  width: 16 },
  ];

  // ── Style header row ──
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3B2C" } };
    cell.font   = { bold: true, color: { argb: "FFB6F53B" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF134B39" } },
      left:   { style: "thin", color: { argb: "FF134B39" } },
      bottom: { style: "thin", color: { argb: "FF134B39" } },
      right:  { style: "thin", color: { argb: "FF134B39" } },
    };
  });
  headerRow.height = 28;

  // ── Add data rows ──
  barang.forEach((b, idx) => {
    const row = ws.addRow({
      sku:       b.sku,
      name:      b.name,
      category:  b.category,
      unit:      b.unit,
      costPrice: b.costPrice,
      sellPrice: b.sellPrice,
      stock:     b.stock,
      minStock:  b.minStock,
    });

    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF2F9F4";
    row.eachCell((cell, colNumber) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 10 };
      cell.alignment = { vertical: "middle" };

      // Number formatting for prices
      if (colNumber === 5 || colNumber === 6) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (colNumber === 7 || colNumber === 8) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      cell.border = {
        top:    { style: "hair", color: { argb: "FFE5EBE7" } },
        left:   { style: "hair", color: { argb: "FFE5EBE7" } },
        bottom: { style: "hair", color: { argb: "FFE5EBE7" } },
        right:  { style: "hair", color: { argb: "FFE5EBE7" } },
      };
    });
    row.height = 18;
  });

  // ── Freeze header row ──
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Auto filter on header ──
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: ws.columns.length },
  };

  // ── Petunjuk sheet ──
  const wsInfo = workbook.addWorksheet("Petunjuk");
  wsInfo.columns = [{ header: "", key: "info", width: 75 }];

  const info = [
    ["PETUNJUK PENGGUNAAN FILE IMPOR DATA BARANG & STOK — KOPIFY"],
    [""],
    [`File ini berisi ${barang.length} item barang & stok dummy siap impor ke Sistem Informasi Koperasi (Kopify).`],
    [""],
    ["CARA IMPOR:"],
    ["1. Login ke Kopify sebagai Admin atau Kasir"],
    ["2. Klik menu 'Impor Excel' di sidebar"],
    ["3. Pilih jenis data: Barang & Stok"],
    ["4. Unggah file ini (.xlsx)"],
    ["5. Sistem akan auto-mapping kolom secara otomatis"],
    ["6. Periksa pratinjau & validasi — pastikan 0 error"],
    ["7. Klik Konfirmasi & Impor"],
    [""],
    ["KETERANGAN KOLOM:"],
    ["SKU / Kode Barang : Wajib. Harus unik (contoh: BRG-FNB-001)"],
    ["Nama Barang       : Wajib. Nama produk lengkap"],
    ["Kategori          : Wajib. Otomatis dibuatkan jika belum ada di sistem"],
    ["Satuan            : Wajib. Contoh: Bungkus, Botol, Pcs, Kg, dsb"],
    ["Harga Beli (Rp)   : Wajib. Angka integer (harga modal/HPP)"],
    ["Harga Jual (Rp)   : Wajib. Angka integer"],
    ["Stok Awal         : Opsional. Jumlah stok fisik awal (akan dicatat sebagai pergerakan stok IMPORT)"],
    ["Batas Min. Stok   : Opsional. Peringatan stok menipis jika stok <= nilai ini"],
    [""],
    ["MODE DUPLIKAT:"],
    ["- LEWATI  : Jika SKU sudah ada, baris dilewati (tidak error)"],
    ["- PERBARUI: Jika SKU sudah ada, harga & stok akan diperbarui"],
    ["- ERROR   : Jika SKU sudah ada, ditandai sebagai error"],
  ];

  info.forEach((line, i) => {
    const r = wsInfo.addRow({ info: line[0] });
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 13, color: { argb: "FF0B3B2C" } };
    } else if (["CARA IMPOR:", "KETERANGAN KOLOM:", "MODE DUPLIKAT:"].includes(line[0])) {
      r.getCell(1).font = { bold: true, size: 11, color: { argb: "FF134B39" } };
    } else {
      r.getCell(1).font = { size: 10 };
    }
  });

  const outDir = path.resolve(process.cwd(), "dummy-data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "Data_Dummy_Barang_Stok_Kopify.xlsx");
  await workbook.xlsx.writeFile(outPath);

  console.log("\n✅ File barang berhasil dibuat:");
  console.log(`   ${outPath}`);
  console.log(`   📦 Total barang  : ${barang.length} baris`);
  console.log(`   📄 Sheet         : "Data Barang" + "Petunjuk"\n`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
