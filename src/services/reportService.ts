import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import ExcelJS from "exceljs";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Helper to get day bounds in Asia/Jakarta (WIB: UTC+7)
 */
export function getJakartaDayBounds(dateStr: string): DateRange {
  // dateStr is 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split("-").map(Number);
  // Jakarta midnight is UTC (date - 7 hours)
  const startDate = new Date(Date.UTC(y, m - 1, d, 0 - 7, 0, 0, 0));
  const endDate = new Date(Date.UTC(y, m - 1, d, 23 - 7, 59, 59, 999));
  return { startDate, endDate };
}

/**
 * 1. Laporan Harian (PRD 6.8)
 */
export async function getDailyReport(dateStr: string) {
  const { startDate, endDate } = getJakartaDayBounds(dateStr);

  const sales = await db.sale.findMany({
    where: {
      status: "AKTIF",
      soldAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      member: true,
      createdBy: true,
      items: {
        include: {
          product: {
            include: { category: true, unit: true },
          },
        },
      },
    },
    orderBy: { soldAt: "desc" },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalDiscount = 0;
  const paymentMethodSummary: Record<string, { count: number; total: number }> = {
    TUNAI: { count: 0, total: 0 },
    TRANSFER: { count: 0, total: 0 },
    DICATAT: { count: 0, total: 0 },
    BON: { count: 0, total: 0 },
  };

  const productSummaryMap: Record<
    string,
    { name: string; sku: string; unit: string; qty: number; revenue: number; profit: number }
  > = {};

  for (const s of sales) {
    totalRevenue += s.total;
    totalDiscount += s.discount || 0;

    const pm = s.paymentMethod || "TUNAI";
    if (!paymentMethodSummary[pm]) {
      paymentMethodSummary[pm] = { count: 0, total: 0 };
    }
    paymentMethodSummary[pm].count += 1;
    paymentMethodSummary[pm].total += s.total;

    for (const item of s.items) {
      const itemCost = (item.costPrice || 0) * item.qty;
      const itemRev = item.unitPrice * item.qty;
      const itemProfit = itemRev - itemCost;
      totalCost += itemCost;

      const pId = item.productId;
      if (!productSummaryMap[pId]) {
        productSummaryMap[pId] = {
          name: item.product?.name || "Barang",
          sku: item.product?.sku || "-",
          unit: item.product?.unit?.name || "unit",
          qty: 0,
          revenue: 0,
          profit: 0,
        };
      }
      productSummaryMap[pId].qty += item.qty;
      productSummaryMap[pId].revenue += itemRev;
      productSummaryMap[pId].profit += itemProfit;
    }
  }

  // Gross Profit = Revenue - Cost (PRD FR-8.2)
  const grossProfit = totalRevenue - totalCost;
  const productSummary = Object.values(productSummaryMap).sort((a, b) => b.qty - a.qty);

  return {
    date: dateStr,
    totalTransactions: sales.length,
    totalRevenue,
    totalCost,
    grossProfit,
    totalDiscount,
    sales,
    paymentMethodSummary,
    productSummary,
  };
}

/**
 * 2. Laporan Pekanan (Weekly Report, Senin - Minggu)
 */
export async function getWeeklyReport(year: number, weekNumber: number) {
  // Calculate start (Monday) and end (Sunday) of ISO week
  const simple = new Date(Date.UTC(year, 0, 1 + (weekNumber - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());

  const startDate = new Date(ISOweekStart);
  startDate.setUTCHours(0 - 7, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  endDate.setUTCMilliseconds(-1);

  // Previous week for comparison
  const prevStartDate = new Date(startDate);
  prevStartDate.setUTCDate(prevStartDate.getUTCDate() - 7);
  const prevEndDate = new Date(endDate);
  prevEndDate.setUTCDate(prevEndDate.getUTCDate() - 7);

  const [currentSales, prevSales] = await Promise.all([
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: startDate, lte: endDate } },
      include: { items: { include: { product: true } } },
    }),
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: prevStartDate, lte: prevEndDate } },
      select: { total: true },
    }),
  ]);

  // Breakdown per day (Monday to Sunday)
  const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const daysBreakdown = dayNames.map((name, i) => {
    const dStart = new Date(startDate);
    dStart.setUTCDate(dStart.getUTCDate() + i);
    const dEnd = new Date(dStart);
    dEnd.setUTCDate(dEnd.getUTCDate() + 1);
    dEnd.setUTCMilliseconds(-1);

    const daySales = currentSales.filter((s) => s.soldAt >= dStart && s.soldAt <= dEnd);
    const dayTotal = daySales.reduce((sum, s) => sum + s.total, 0);
    return { day: name, total: dayTotal, count: daySales.length };
  });

  const totalRevenue = currentSales.reduce((sum, s) => sum + s.total, 0);
  const prevTotalRevenue = prevSales.reduce((sum, s) => sum + s.total, 0);
  const growthRate =
    prevTotalRevenue > 0
      ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100)
      : totalRevenue > 0
      ? 100
      : 0;

  let totalCost = 0;
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const s of currentSales) {
    for (const item of s.items) {
      totalCost += (item.costPrice || 0) * item.qty;
      const pid = item.productId;
      if (!productMap[pid]) {
        productMap[pid] = { name: item.product?.name || "Barang", qty: 0, revenue: 0 };
      }
      productMap[pid].qty += item.qty;
      productMap[pid].revenue += item.unitPrice * item.qty;
    }
  }

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return {
    year,
    weekNumber,
    startDate,
    endDate,
    totalRevenue,
    prevTotalRevenue,
    growthRate,
    grossProfit: totalRevenue - totalCost,
    totalTransactions: currentSales.length,
    daysBreakdown,
    topProducts,
  };
}

/**
 * 3. Laporan Bulanan (Monthly Report)
 */
export async function getMonthlyReport(year: number, month: number) {
  // month: 1 to 12
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0 - 7, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23 - 7, 59, 59, 999));

  // Previous month bounds
  const prevMonthStart = new Date(Date.UTC(year, month - 2, 1, 0 - 7, 0, 0, 0));
  const prevMonthEnd = new Date(Date.UTC(year, month - 1, 0, 23 - 7, 59, 59, 999));

  const [currentSales, prevSales, lowStockProducts] = await Promise.all([
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: startDate, lte: endDate } },
      include: {
        items: {
          include: {
            product: { include: { category: true, unit: true } },
          },
        },
      },
    }),
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      select: { total: true },
    }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: { category: true, unit: true },
    }),
  ]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyBreakdown = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dStart = new Date(Date.UTC(year, month - 1, day, 0 - 7, 0, 0, 0));
    const dEnd = new Date(Date.UTC(year, month - 1, day, 23 - 7, 59, 59, 999));
    const salesInDay = currentSales.filter((s) => s.soldAt >= dStart && s.soldAt <= dEnd);
    const total = salesInDay.reduce((sum, s) => sum + s.total, 0);
    return { date: `${day}/${month}`, total, count: salesInDay.length };
  });

  const totalRevenue = currentSales.reduce((sum, s) => sum + s.total, 0);
  const prevRevenue = prevSales.reduce((sum, s) => sum + s.total, 0);
  const growthRate =
    prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : totalRevenue > 0
      ? 100
      : 0;

  let totalCost = 0;
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  const categoryMap: Record<string, { name: string; revenue: number }> = {};

  for (const s of currentSales) {
    for (const it of s.items) {
      totalCost += (it.costPrice || 0) * it.qty;
      const pid = it.productId;
      if (!productMap[pid]) {
        productMap[pid] = { name: it.product?.name || "Barang", qty: 0, revenue: 0 };
      }
      productMap[pid].qty += it.qty;
      productMap[pid].revenue += it.unitPrice * it.qty;

      const catName = it.product?.category?.name || "Lain-lain";
      if (!categoryMap[catName]) {
        categoryMap[catName] = { name: catName, revenue: 0 };
      }
      categoryMap[catName].revenue += it.unitPrice * it.qty;
    }
  }

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
  const topCategories = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);
  const lowStock = lowStockProducts.filter((p) => p.stock <= p.minStock);

  return {
    year,
    month,
    totalRevenue,
    prevRevenue,
    growthRate,
    grossProfit: totalRevenue - totalCost,
    totalTransactions: currentSales.length,
    dailyBreakdown,
    topProducts,
    topCategories,
    lowStockCount: lowStock.length,
    lowStock,
  };
}

/**
 * 4. Laporan Tahunan (Yearly Report)
 */
export async function getYearlyReport(year: number) {
  const startDate = new Date(Date.UTC(year, 0, 1, 0 - 7, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, 11, 31, 23 - 7, 59, 59, 999));

  const prevYearStart = new Date(Date.UTC(year - 1, 0, 1, 0 - 7, 0, 0, 0));
  const prevYearEnd = new Date(Date.UTC(year - 1, 11, 31, 23 - 7, 59, 59, 999));

  const [currentSales, prevSales] = await Promise.all([
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: startDate, lte: endDate } },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
      },
    }),
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: prevYearStart, lte: prevYearEnd } },
      select: { total: true },
    }),
  ]);

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  const monthlyBreakdown = monthNames.map((name, i) => {
    const mStart = new Date(Date.UTC(year, i, 1, 0 - 7, 0, 0, 0));
    const mEnd = new Date(Date.UTC(year, i + 1, 0, 23 - 7, 59, 59, 999));
    const salesInM = currentSales.filter((s) => s.soldAt >= mStart && s.soldAt <= mEnd);
    const total = salesInM.reduce((sum, s) => sum + s.total, 0);
    return { month: name, total, count: salesInM.length };
  });

  const totalRevenue = currentSales.reduce((sum, s) => sum + s.total, 0);
  const prevRevenue = prevSales.reduce((sum, s) => sum + s.total, 0);
  const growthRate =
    prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : totalRevenue > 0
      ? 100
      : 0;

  let totalCost = 0;
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  const categoryMap: Record<string, { name: string; revenue: number }> = {};

  for (const s of currentSales) {
    for (const it of s.items) {
      totalCost += (it.costPrice || 0) * it.qty;
      const pid = it.productId;
      if (!productMap[pid]) {
        productMap[pid] = { name: it.product?.name || "Barang", qty: 0, revenue: 0 };
      }
      productMap[pid].qty += it.qty;
      productMap[pid].revenue += it.unitPrice * it.qty;

      const cName = it.product?.category?.name || "Lain-lain";
      if (!categoryMap[cName]) {
        categoryMap[cName] = { name: cName, revenue: 0 };
      }
      categoryMap[cName].revenue += it.unitPrice * it.qty;
    }
  }

  return {
    year,
    totalRevenue,
    prevRevenue,
    growthRate,
    grossProfit: totalRevenue - totalCost,
    totalTransactions: currentSales.length,
    monthlyBreakdown,
    topProducts: Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 10),
    topCategories: Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue),
  };
}

/**
 * 5. Laporan Posisi Stok & Nilai Persediaan
 */
export async function getStockValuationReport() {
  const products = await db.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: { category: true, unit: true },
    orderBy: { name: "asc" },
  });

  let totalInventoryCost = 0; // stok * costPrice
  let totalInventoryRetail = 0; // stok * sellPrice

  const productRows = products.map((p) => {
    const valuationCost = p.stock * p.costPrice;
    const valuationRetail = p.stock * p.sellPrice;
    totalInventoryCost += valuationCost;
    totalInventoryRetail += valuationRetail;

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category.name,
      unit: p.unit.name,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      stock: p.stock,
      reservedStock: p.reservedStock,
      availableStock: Math.max(0, p.stock - p.reservedStock),
      minStock: p.minStock,
      valuationCost,
      valuationRetail,
      potentialProfit: valuationRetail - valuationCost,
      isLowStock: p.stock <= p.minStock,
    };
  });

  return {
    totalItems: products.length,
    totalInventoryCost,
    totalInventoryRetail,
    potentialProfit: totalInventoryRetail - totalInventoryCost,
    products: productRows,
  };
}

/**
 * 6. Generate Excel Report (.xlsx) using ExcelJS
 */
export async function generateReportExcel(type: string, params: Record<string, any>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kopify — Sistem Koperasi";
  workbook.created = new Date();

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3B2C" },
  };
  const headerFont = { color: { argb: "FFFFFFFF" }, bold: true };

  if (type === "HARIAN") {
    const data = await getDailyReport(params.date || new Date().toISOString().split("T")[0]);
    const sheet = workbook.addWorksheet("Laporan Harian");

    sheet.addRow(["LAPORAN PENJUALAN HARIAN — KOPIFY MART"]);
    sheet.addRow([`Tanggal: ${data.date}`]);
    sheet.addRow([`Total Omzet: ${formatRupiah(data.totalRevenue)}`]);
    sheet.addRow([`Laba Kotor (Gross Profit): ${formatRupiah(data.grossProfit)}`]);
    sheet.addRow([`Total Modal (HPP): ${formatRupiah(data.totalCost)}`]);
    sheet.addRow([`Total Diskon: ${formatRupiah(data.totalDiscount)}`]);
    sheet.addRow([`Total Transaksi: ${data.totalTransactions}`]);
    sheet.addRow([]);

    // Metode Bayar
    sheet.addRow(["RINGKASAN METODE PEMBAYARAN"]);
    const pmHeader = sheet.addRow(["Metode Pembayaran", "Jumlah Transaksi", "Total Nominal"]);
    pmHeader.fill = headerFill;
    pmHeader.font = headerFont;
    Object.entries(data.paymentMethodSummary).forEach(([m, v]: any) => {
      sheet.addRow([m, v.count, v.total]);
    });
    sheet.addRow([]);

    // Rincian Barang
    sheet.addRow(["RINCIAN BARANG TERJUAL"]);
    const prodHeader = sheet.addRow(["No", "SKU", "Nama Barang", "Satuan", "Kuantitas Terjual", "Total Omzet", "Estimasi Laba Kotor"]);
    prodHeader.fill = headerFill;
    prodHeader.font = headerFont;
    data.productSummary.forEach((p, idx) => {
      sheet.addRow([idx + 1, p.sku, p.name, p.unit, p.qty, p.revenue, p.profit]);
    });
    sheet.addRow([]);

    // Daftar Transaksi
    sheet.addRow(["DAFTAR STRUK TRANSAKSI PENJUALAN"]);
    const txHeader = sheet.addRow(["No", "No. Penjualan", "Waktu (WIB)", "Pelanggan", "Metode Bayar", "Diskon (Rp)", "Total Bayar (Rp)"]);
    txHeader.fill = headerFill;
    txHeader.font = headerFont;
    data.sales.forEach((s, idx) => {
      sheet.addRow([
        idx + 1,
        s.saleNo,
        new Date(s.soldAt).toLocaleTimeString("id-ID"),
        s.member?.name || "Pelanggan Umum",
        s.paymentMethod,
        s.discount || 0,
        s.total,
      ]);
    });

    sheet.columns.forEach((col) => {
      col.width = 20;
    });
  } else if (type === "PEKANAN") {
    const now = new Date();
    const year = params.year || now.getFullYear();
    const week = params.week || Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
    const data = await getWeeklyReport(year, week);
    const sheet = workbook.addWorksheet("Laporan Pekanan");

    sheet.addRow(["LAPORAN PENJUALAN PEKANAN — KOPIFY MART"]);
    sheet.addRow([`Tahun: ${data.year}, Minggu Ke: ${data.weekNumber}`]);
    sheet.addRow([`Total Omzet Pekan Ini: ${formatRupiah(data.totalRevenue)}`]);
    sheet.addRow([`Laba Kotor: ${formatRupiah(data.grossProfit)}`]);
    sheet.addRow([`Total Transaksi: ${data.totalTransactions}`]);
    sheet.addRow([`Omzet Pekan Lalu: ${formatRupiah(data.prevTotalRevenue)}`]);
    sheet.addRow([`Pertumbuhan: ${data.growthRate >= 0 ? `+${data.growthRate}%` : `${data.growthRate}%`}`]);
    sheet.addRow([]);

    // Penjualan per hari
    sheet.addRow(["PENJUALAN PER HARI (SENIN – MINGGU)"]);
    const dayHeader = sheet.addRow(["Hari", "Jumlah Transaksi", "Total Omzet (Rp)"]);
    dayHeader.fill = headerFill;
    dayHeader.font = headerFont;
    data.daysBreakdown.forEach((d) => {
      sheet.addRow([d.day, d.count, d.total]);
    });
    sheet.addRow([]);

    // 10 Barang Terlaris
    sheet.addRow(["10 BARANG TERLARIS PEKANAN"]);
    const topHeader = sheet.addRow(["No", "Nama Barang", "Kuantitas Terjual", "Total Omzet (Rp)"]);
    topHeader.fill = headerFill;
    topHeader.font = headerFont;
    data.topProducts.forEach((p, idx) => {
      sheet.addRow([idx + 1, p.name, p.qty, p.revenue]);
    });

    sheet.columns.forEach((col) => {
      col.width = 24;
    });
  } else if (type === "BULANAN") {
    const now = new Date();
    const year = params.year || now.getFullYear();
    const month = params.month || now.getMonth() + 1;
    const data = await getMonthlyReport(year, month);
    const sheet = workbook.addWorksheet("Laporan Bulanan");

    sheet.addRow(["LAPORAN PENJUALAN BULANAN — KOPIFY MART"]);
    sheet.addRow([`Bulan: ${month}, Tahun: ${year}`]);
    sheet.addRow([`Total Omzet Bulan Ini: ${formatRupiah(data.totalRevenue)}`]);
    sheet.addRow([`Laba Kotor: ${formatRupiah(data.grossProfit)}`]);
    sheet.addRow([`Total Transaksi: ${data.totalTransactions}`]);
    sheet.addRow([`Omzet Bulan Lalu: ${formatRupiah(data.prevRevenue)}`]);
    sheet.addRow([`Pertumbuhan: ${data.growthRate >= 0 ? `+${data.growthRate}%` : `${data.growthRate}%`}`]);
    sheet.addRow([`Jumlah Barang Stok Menipis: ${data.lowStockCount}`]);
    sheet.addRow([]);

    // Rincian Penjualan Harian
    sheet.addRow(["RINCIAN PENJUALAN HARIAN DALAM BULAN"]);
    const mDayHeader = sheet.addRow(["Tanggal (Tgl/Bln)", "Jumlah Transaksi", "Total Omzet (Rp)"]);
    mDayHeader.fill = headerFill;
    mDayHeader.font = headerFont;
    data.dailyBreakdown.forEach((d) => {
      sheet.addRow([d.date, d.count, d.total]);
    });
    sheet.addRow([]);

    // Kategori Terlaris
    sheet.addRow(["KATEGORI BARANG TERLARIS"]);
    const catHeader = sheet.addRow(["No", "Kategori", "Total Omzet (Rp)"]);
    catHeader.fill = headerFill;
    catHeader.font = headerFont;
    data.topCategories.forEach((c, idx) => {
      sheet.addRow([idx + 1, c.name, c.revenue]);
    });
    sheet.addRow([]);

    // 10 Barang Terlaris
    sheet.addRow(["10 BARANG TERLARIS BULANAN"]);
    const topProdHeader = sheet.addRow(["No", "Nama Barang", "Kuantitas Terjual", "Total Omzet (Rp)"]);
    topProdHeader.fill = headerFill;
    topProdHeader.font = headerFont;
    data.topProducts.forEach((p, idx) => {
      sheet.addRow([idx + 1, p.name, p.qty, p.revenue]);
    });

    sheet.columns.forEach((col) => {
      col.width = 24;
    });
  } else if (type === "TAHUNAN") {
    const year = params.year || new Date().getFullYear();
    const data = await getYearlyReport(year);
    const sheet = workbook.addWorksheet("Laporan Tahunan");

    sheet.addRow(["LAPORAN PENJUALAN TAHUNAN — KOPIFY MART"]);
    sheet.addRow([`Tahun: ${year}`]);
    sheet.addRow([`Total Omzet Tahunan: ${formatRupiah(data.totalRevenue)}`]);
    sheet.addRow([`Total Laba Kotor: ${formatRupiah(data.grossProfit)}`]);
    sheet.addRow([`Total Transaksi: ${data.totalTransactions}`]);
    sheet.addRow([`Omzet Tahun Lalu: ${formatRupiah(data.prevRevenue)}`]);
    sheet.addRow([`Pertumbuhan: ${data.growthRate >= 0 ? `+${data.growthRate}%` : `${data.growthRate}%`}`]);
    sheet.addRow([]);

    // Rekap Per Bulan
    sheet.addRow(["REKAPITULASI PENJUALAN PER BULAN (JANUARI – DESEMBER)"]);
    const yrHeader = sheet.addRow(["Bulan", "Jumlah Transaksi", "Total Omzet (Rp)"]);
    yrHeader.fill = headerFill;
    yrHeader.font = headerFont;
    data.monthlyBreakdown.forEach((m) => {
      sheet.addRow([m.month, m.count, m.total]);
    });
    sheet.addRow([]);

    // Top Kategori
    sheet.addRow(["KATEGORI TERLARIS TAHUNAN"]);
    const yrCatHeader = sheet.addRow(["No", "Kategori", "Total Omzet (Rp)"]);
    yrCatHeader.fill = headerFill;
    yrCatHeader.font = headerFont;
    data.topCategories.forEach((c, idx) => {
      sheet.addRow([idx + 1, c.name, c.revenue]);
    });
    sheet.addRow([]);

    // Top Produk
    sheet.addRow(["10 BARANG TERLARIS TAHUNAN"]);
    const yrTopHeader = sheet.addRow(["No", "Nama Barang", "Kuantitas Terjual", "Total Omzet (Rp)"]);
    yrTopHeader.fill = headerFill;
    yrTopHeader.font = headerFont;
    data.topProducts.forEach((p, idx) => {
      sheet.addRow([idx + 1, p.name, p.qty, p.revenue]);
    });

    sheet.columns.forEach((col) => {
      col.width = 24;
    });
  } else if (type === "STOK") {
    const data = await getStockValuationReport();
    const sheet = workbook.addWorksheet("Posisi Stok & Nilai");

    sheet.addRow(["LAPORAN POSISI STOK & NILAI PERSEDIAAN — KOPIFY MART"]);
    sheet.addRow([`Total Jenis Barang: ${data.totalItems}`]);
    sheet.addRow([`Total Nilai Persediaan Modal (Harga Beli): ${formatRupiah(data.totalInventoryCost)}`]);
    sheet.addRow([`Total Nilai Persediaan Jual (Harga Jual): ${formatRupiah(data.totalInventoryRetail)}`]);
    sheet.addRow([`Potensi Margin Laba: ${formatRupiah(data.potentialProfit)}`]);
    sheet.addRow([]);

    sheet.addRow([
      "No",
      "SKU",
      "Nama Barang",
      "Kategori",
      "Satuan",
      "Stok Fisik",
      "Dicadangkan (Reserved)",
      "Stok Tersedia",
      "Harga Beli (Rp)",
      "Harga Jual (Rp)",
      "Nilai Persediaan Modal (Rp)",
      "Nilai Persediaan Jual (Rp)",
      "Potensi Laba (Rp)",
      "Status Stok",
    ]);

    data.products.forEach((p, idx) => {
      sheet.addRow([
        idx + 1,
        p.sku,
        p.name,
        p.category,
        p.unit,
        p.stock,
        p.reservedStock,
        p.availableStock,
        p.costPrice,
        p.sellPrice,
        p.valuationCost,
        p.valuationRetail,
        p.potentialProfit,
        p.isLowStock ? "MENIPIS" : "AMAN",
      ]);
    });

    sheet.columns.forEach((col) => {
      col.width = 22;
    });
  }

  return await workbook.xlsx.writeBuffer();
}
