import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getDailyReport,
  getMonthlyReport,
  getStockValuationReport,
  generateReportExcel,
} from "../src/services/reportService";

const db = new PrismaClient();

describe("Fase 4: AC 6.7 & AC 6.8 - Laporan Keuangan & Dasbor Analitik", () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("FR-6.8 & AC 6.8: menghasilkan laporan harian dengan perhitungan laba kotor yang akurat", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const report = await getDailyReport(todayStr);

    expect(report.date).toBe(todayStr);
    expect(typeof report.totalTransactions).toBe("number");
    expect(typeof report.totalRevenue).toBe("number");
    expect(typeof report.grossProfit).toBe("number");
    expect(report.grossProfit).toBe(report.totalRevenue - report.totalCost);

    // Rincian metode pembayaran tersedia
    expect(report.paymentMethodSummary).toHaveProperty("TUNAI");
    expect(report.paymentMethodSummary).toHaveProperty("TRANSFER");
  });

  it("FR-6.8: laporan posisi stok menghitung nilai persediaan modal dan potensi margin laba", async () => {
    const valuation = await getStockValuationReport();

    expect(valuation.totalItems).toBeGreaterThan(0);
    expect(valuation.totalInventoryCost).toBeGreaterThan(0);
    expect(valuation.totalInventoryRetail).toBeGreaterThanOrEqual(valuation.totalInventoryCost);
    expect(valuation.potentialProfit).toBe(
      valuation.totalInventoryRetail - valuation.totalInventoryCost
    );
  });

  it("FR-8.1: ekspor Excel (.xlsx) menghasilkan file binary buffer valid", async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const excelBuffer = await generateReportExcel("HARIAN", { date: todayStr });

    expect(excelBuffer).toBeDefined();
    // Valid zip/xlsx header begins with PK (0x50, 0x4B)
    const uint8 = new Uint8Array(excelBuffer as ArrayBuffer);
    expect(uint8[0]).toBe(0x50);
    expect(uint8[1]).toBe(0x4b);
  });
});
