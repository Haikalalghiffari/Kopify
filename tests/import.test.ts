import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  autoSuggestMappings,
  validateImportRows,
  executeBatchImport,
} from "../src/services/importService";

const db = new PrismaClient();

describe("AC 6.3 - Wizard Impor Data Excel & Konversi Sistem Lama", () => {
  let adminUser: any;

  beforeAll(async () => {
    await db.$connect();
    adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
  });

  afterAll(async () => {
    // Clean up test data
    await db.stockMovement.deleteMany({
      where: {
        product: { sku: { in: ["IMP-BRG-01", "IMP-BRG-02"] } },
      },
    });
    await db.member.deleteMany({
      where: { memberNo: { in: ["IMP-ANG-01", "IMP-ANG-02"] } },
    });
    await db.product.deleteMany({
      where: { sku: { in: ["IMP-BRG-01", "IMP-BRG-02"] } },
    });
    await db.importLog.deleteMany({
      where: { filename: "test_import.xlsx" },
    });
    await db.$disconnect();
  });

  it("mendeteksi dan menyarankan pemetaan kolom otomatis (auto-suggest)", () => {
    const rawHeaders = ["No Anggota", "Nama Lengkap", "Nomor HP", "Alamat Domisili"];
    const suggestions = autoSuggestMappings(rawHeaders, "ANGGOTA");

    expect(suggestions["No Anggota"]).toBe("memberNo");
    expect(suggestions["Nama Lengkap"]).toBe("name");
    expect(suggestions["Nomor HP"]).toBe("phone");
    expect(suggestions["Alamat Domisili"]).toBe("address");
  });

  it("memvalidasi data dan mendeteksi baris error dengan pesan jelas", () => {
    const rows = [
      { "No Anggota": "IMP-ANG-01", "Nama": "Budi Valid", "HP": "0812345" },
      { "No Anggota": "", "Nama": "Tanpa Nomor", "HP": "0812346" }, // Error: No Anggota kosong
    ];
    const mappings = {
      "No Anggota": "memberNo",
      "Nama": "name",
      "HP": "phone",
    };

    const summary = validateImportRows(rows, mappings, "ANGGOTA");

    expect(summary.totalRows).toBe(2);
    expect(summary.validCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(summary.errors[0].message).toContain("wajib diisi");
  });

  it("FR-3.1 & FR-3.6: mengeksekusi impor barang dengan stok awal tercatat sebagai IMPORT", async () => {
    const rows = [
      {
        "Kode": "IMP-BRG-01",
        "Nama Produk": "Beras Uji Impor 5kg",
        "Kategori": "Sembako",
        "Satuan": "kg",
        "Harga Beli": "50.000",
        "Harga Jual": "55.000",
        "Stok": "25",
        "Min Stok": "5",
      },
    ];
    const mappings = {
      "Kode": "sku",
      "Nama Produk": "name",
      "Kategori": "category",
      "Satuan": "unit",
      "Harga Beli": "costPrice",
      "Harga Jual": "sellPrice",
      "Stok": "stock",
      "Min Stok": "minStock",
    };

    const result = await executeBatchImport({
      rows,
      mappings,
      type: "BARANG",
      duplicateMode: "SKIP",
      userId: adminUser.id,
      filename: "test_import.xlsx",
    });

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);

    // Verifikasi produk tersimpan di database
    const saved = await db.product.findUnique({
      where: { sku: "IMP-BRG-01" },
      include: { stockMovements: true },
    });

    expect(saved).not.toBeNull();
    expect(saved?.stock).toBe(25);
    expect(saved?.sellPrice).toBe(55000);

    // FR-3.6: Verifikasi stok awal tercatat sebagai pergerakan stok IMPORT
    expect(saved?.stockMovements.length).toBeGreaterThan(0);
    expect(saved?.stockMovements[0].type).toBe("IMPORT");
    expect(saved?.stockMovements[0].qtyChange).toBe(25);

    // FR-3.3: Verifikasi log tercatat
    const log = await db.importLog.findUnique({ where: { id: result.logId } });
    expect(log).not.toBeNull();
    expect(log?.status).toBe("SUKSES");
  });

  it("FR-3.1: mode duplikat SKIP mengabaikan data duplikat tanpa error ganda", async () => {
    const rows = [
      {
        "Kode": "IMP-BRG-01", // Sudah ada
        "Nama Produk": "Nama Diubah",
        "Kategori": "Sembako",
        "Satuan": "kg",
        "Harga Beli": "50.000",
        "Harga Jual": "60.000",
        "Stok": "30",
        "Min Stok": "5",
      },
    ];
    const mappings = {
      "Kode": "sku",
      "Nama Produk": "name",
      "Kategori": "category",
      "Satuan": "unit",
      "Harga Beli": "costPrice",
      "Harga Jual": "sellPrice",
      "Stok": "stock",
      "Min Stok": "minStock",
    };

    const result = await executeBatchImport({
      rows,
      mappings,
      type: "BARANG",
      duplicateMode: "SKIP",
      userId: adminUser.id,
      filename: "test_import.xlsx",
    });

    expect(result.skipped).toBe(1);
    expect(result.success).toBe(0);

    // Data lama tidak berubah
    const product = await db.product.findUnique({ where: { sku: "IMP-BRG-01" } });
    expect(product?.name).toBe("Beras Uji Impor 5kg");
  });
});
