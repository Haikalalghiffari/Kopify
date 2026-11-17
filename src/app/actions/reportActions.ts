"use server";

import {
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getYearlyReport,
  getStockValuationReport,
} from "@/services/reportService";

export async function fetchDailyReportAction(dateStr: string) {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr > todayStr) {
      return {
        success: false,
        error: "Laporan hanya dapat menampilkan data historis (hari ini dan hari sebelumnya).",
      };
    }
    const data = await getDailyReport(dateStr);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memuat laporan harian." };
  }
}

export async function fetchWeeklyReportAction(year: number, week: number) {
  try {
    const data = await getWeeklyReport(year, week);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memuat laporan pekanan." };
  }
}

export async function fetchMonthlyReportAction(year: number, month: number) {
  try {
    const data = await getMonthlyReport(year, month);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memuat laporan bulanan." };
  }
}

export async function fetchYearlyReportAction(year: number) {
  try {
    const data = await getYearlyReport(year);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memuat laporan tahunan." };
  }
}

export async function fetchStockValuationAction() {
  try {
    const data = await getStockValuationReport();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memuat laporan stok." };
  }
}
