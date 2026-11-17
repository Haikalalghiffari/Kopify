"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  FileText,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  Package,
  Boxes,
  CheckCircle2,
  CreditCard,
  Layers,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fetchDailyReportAction,
  fetchWeeklyReportAction,
  fetchMonthlyReportAction,
  fetchYearlyReportAction,
} from "@/app/actions/reportActions";

export default function ReportsClient({
  initialDaily,
  initialWeekly,
  initialMonthly,
  initialYearly,
  initialStockValuation,
}: {
  initialDaily: any;
  initialWeekly: any;
  initialMonthly: any;
  initialYearly: any;
  initialStockValuation: any;
}) {
  const [activeTab, setActiveTab] = useState<"HARIAN" | "PEKANAN" | "BULANAN" | "TAHUNAN" | "STOK">("HARIAN");

  // Today max string (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];

  // Daily State
  const [dailyDate, setDailyDate] = useState<string>(initialDaily.date);
  const [dailyData, setDailyData] = useState<any>(initialDaily);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Weekly State
  const [weeklyYear, setWeeklyYear] = useState<number>(initialWeekly.year);
  const [weeklyWeek, setWeeklyWeek] = useState<number>(initialWeekly.weekNumber);
  const [weeklyData, setWeeklyData] = useState<any>(initialWeekly);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  // Monthly State
  const [monthlyYear, setMonthlyYear] = useState<number>(initialMonthly.year);
  const [monthlyMonth, setMonthlyMonth] = useState<number>(initialMonthly.month);
  const [monthlyData, setMonthlyData] = useState<any>(initialMonthly);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Yearly State
  const [yearlyYear, setYearlyYear] = useState<number>(initialYearly.year);
  const [yearlyData, setYearlyData] = useState<any>(initialYearly);
  const [loadingYearly, setLoadingYearly] = useState(false);

  // Handle Date Change for Daily Report (with historical date validation)
  const handleDailyDateChange = async (newDate: string) => {
    if (newDate > todayStr) {
      toast.error("Laporan hanya dapat menampilkan data historis (hari ini dan hari sebelumnya).");
      return;
    }

    setDailyDate(newDate);
    setLoadingDaily(true);
    try {
      const res = await fetchDailyReportAction(newDate);
      if (res.success && res.data) {
        setDailyData(res.data);
        toast.success(`Laporan tanggal ${newDate} berhasil dimuat.`);
      } else {
        toast.error(res.error || "Gagal memuat laporan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data.");
    } finally {
      setLoadingDaily(false);
    }
  };

  // Handle Weekly change
  const handleWeeklyChange = async (w: number, y: number) => {
    setWeeklyWeek(w);
    setWeeklyYear(y);
    setLoadingWeekly(true);
    try {
      const res = await fetchWeeklyReportAction(y, w);
      if (res.success && res.data) {
        setWeeklyData(res.data);
      }
    } finally {
      setLoadingWeekly(false);
    }
  };

  // Handle Monthly change
  const handleMonthlyChange = async (m: number, y: number) => {
    setMonthlyMonth(m);
    setMonthlyYear(y);
    setLoadingMonthly(true);
    try {
      const res = await fetchMonthlyReportAction(y, m);
      if (res.success && res.data) {
        setMonthlyData(res.data);
      }
    } finally {
      setLoadingMonthly(false);
    }
  };

  // Handle Yearly change
  const handleYearlyChange = async (y: number) => {
    setYearlyYear(y);
    setLoadingYearly(true);
    try {
      const res = await fetchYearlyReportAction(y);
      if (res.success && res.data) {
        setYearlyData(res.data);
      }
    } finally {
      setLoadingYearly(false);
    }
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams({
      type: activeTab,
      date: dailyDate,
      year:
        activeTab === "PEKANAN"
          ? weeklyYear.toString()
          : activeTab === "BULANAN"
          ? monthlyYear.toString()
          : yearlyYear.toString(),
      month: monthlyMonth.toString(),
      week: weeklyWeek.toString(),
    });
    window.open(`/api/reports/export?${params.toString()}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* PRINT-ONLY OFFICIAL LETTERHEAD (KOP SURAT RESMI KOPERASI)      */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:block mb-6 text-black border-b-2 border-black pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-black">
              KOPIFY MART — KOPERASI KONSUMEN INDONESIA
            </h1>
            <p className="text-xs text-gray-700 mt-0.5">
              Badan Hukum No: AHU-0012345.AH.01.26.TAHUN 2026 • Wilayah DKI Jakarta
            </p>
            <p className="text-[11px] text-gray-600">
              Alamat: Jl. Koperasi Makmur Bersama No. 1, Jakarta Pusat • Telp: (021) 7890-1234 • Email: info@koperasi.id
            </p>
          </div>
          <div className="text-right text-[11px] text-gray-700">
            <p className="font-bold">DOKUMEN RESMI</p>
            <p>Dicetak: {format(new Date(), "dd/MM/yyyy HH:mm 'WIB'")}</p>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-gray-400 text-center">
          <h2 className="text-base font-black uppercase tracking-wide">
            {activeTab === "HARIAN" && `LAPORAN PENJUALAN HARIAN (TANGGAL ${dailyDate})`}
            {activeTab === "PEKANAN" && `LAPORAN PENJUALAN PEKANAN (MINGGU KE-${weeklyWeek}, TAHUN ${weeklyYear})`}
            {activeTab === "BULANAN" && `LAPORAN PENJUALAN BULANAN (BULAN ${monthlyMonth}, TAHUN ${monthlyYear})`}
            {activeTab === "TAHUNAN" && `LAPORAN PENJUALAN TAHUNAN (TAHUN ${yearlyYear})`}
            {activeTab === "STOK" && `LAPORAN POSISI STOK & VALUASI PERSEDIAAN`}
          </h2>
        </div>
      </div>

      {/* SCREEN-ONLY Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B3B2C] tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            <span>Laporan & Pembukuan Keuangan</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Rekap transaksi penjualan, perhitungan laba kotor otomatis, omzet periodik, dan valuasi persediaan stok.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak / Simpan PDF</span>
          </Button>
          <Button
            onClick={handleExportExcel}
            className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
          >
            <Download className="h-4 w-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </Button>
        </div>
      </div>

      {/* SCREEN-ONLY Tabs */}
      <div className="print:hidden flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200">
        {[
          { key: "HARIAN", label: "Laporan Harian" },
          { key: "PEKANAN", label: "Laporan Pekanan" },
          { key: "BULANAN", label: "Laporan Bulanan" },
          { key: "TAHUNAN", label: "Laporan Tahunan" },
          { key: "STOK", label: "Posisi & Nilai Stok" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[#0B3B2C] text-white shadow-xs"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* 1. LAPORAN HARIAN                                             */}
      {/* ============================================================= */}
      {activeTab === "HARIAN" && (
        <div className="space-y-6">
          {/* SCREEN-ONLY Filter Bar with max={todayStr} */}
          <div className="print:hidden bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-gray-700">Pilih Tanggal Laporan:</span>
              <input
                type="date"
                value={dailyDate}
                max={todayStr}
                onChange={(e) => handleDailyDateChange(e.target.value)}
                className="text-xs p-2 rounded-xl border border-gray-200 font-bold text-[#0B3B2C] focus:ring-2 focus:ring-[#0B3B2C]"
              />
              {loadingDaily && (
                <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat data...
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-400 italic">
              *Hanya dapat memilih tanggal hari ini dan tanggal sebelumnya (data historikal).
            </span>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-1 print-card">
              <span className="text-xs text-gray-500 font-semibold">Total Omzet Penjualan</span>
              <p className="text-xl sm:text-2xl font-black text-[#0B3B2C]">
                {formatRupiah(dailyData.totalRevenue)}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                {dailyData.totalTransactions} transaksi berhasil
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-1 print-card">
              <span className="text-xs text-gray-500 font-semibold">Laba Kotor (Gross Profit)</span>
              <p className="text-xl sm:text-2xl font-black text-emerald-700">
                {formatRupiah(dailyData.grossProfit)}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">Σ (Harga Jual - HPP) × Qty</p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-1 print-card">
              <span className="text-xs text-gray-500 font-semibold">Total Modal Barang (HPP)</span>
              <p className="text-xl sm:text-2xl font-black text-gray-700">
                {formatRupiah(dailyData.totalCost)}
              </p>
              <p className="text-[11px] text-gray-400 font-medium">Snapshot cost price</p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-1 print-card">
              <span className="text-xs text-gray-500 font-semibold">Total Diskon Diberikan</span>
              <p className="text-xl sm:text-2xl font-black text-orange-600">
                {formatRupiah(dailyData.totalDiscount)}
              </p>
              <p className="text-[11px] text-gray-400 font-medium">Potongan kasir</p>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-3 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Rincian Per Metode Pembayaran
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(dailyData.paymentMethodSummary).map(([method, val]: any) => (
                <div key={method} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    {method}
                  </span>
                  <p className="text-base font-black text-gray-900 mt-0.5">
                    {formatRupiah(val.total)}
                  </p>
                  <span className="text-[11px] text-gray-500 font-medium">{val.count} transaksi</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Sales Breakdown */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-4 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Rincian Barang Terjual ({dailyData.productSummary.length} Jenis Produk)
            </h3>
            {dailyData.productSummary.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                Tidak ada data barang terjual pada tanggal {dailyDate}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-3 text-center">Terjual (Qty)</th>
                      <th className="py-2.5 px-3 text-right">Total Omzet</th>
                      <th className="py-2.5 px-3 text-right">Estimasi Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dailyData.productSummary.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500">{item.sku}</td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-gray-900">
                          {item.qty} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#0B3B2C]">
                          {formatRupiah(item.revenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {formatRupiah(item.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daftar Struk Penjualan */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-4 print-card print-page-break-before">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Daftar Struk Transaksi Penjualan ({dailyData.sales.length} Transaksi)
            </h3>
            {dailyData.sales.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                Tidak ada transaksi penjualan pada tanggal {dailyDate}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">No. Penjualan</th>
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">Pelanggan</th>
                      <th className="py-2.5 px-3">Metode Bayar</th>
                      <th className="py-2.5 px-3 text-right">Diskon</th>
                      <th className="py-2.5 px-3 text-right">Total Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dailyData.sales.map((s: any, idx: number) => (
                      <tr key={s.id} className="hover:bg-gray-50/50">
                        <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-gray-900">{s.saleNo}</td>
                        <td className="py-2 px-3 text-gray-500">
                          {format(new Date(s.soldAt), "HH:mm:ss")}
                        </td>
                        <td className="py-2 px-3 font-semibold text-gray-800">
                          {s.member?.name || "Pelanggan Umum"}
                        </td>
                        <td className="py-2 px-3 font-bold text-gray-700">{s.paymentMethod}</td>
                        <td className="py-2 px-3 text-right text-orange-600 font-medium">
                          {formatRupiah(s.discount || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-[#0B3B2C]">
                          {formatRupiah(s.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. LAPORAN PEKANAN                                            */}
      {/* ============================================================= */}
      {activeTab === "PEKANAN" && (
        <div className="space-y-6">
          {/* SCREEN-ONLY Filter Bar */}
          <div className="print:hidden bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700">Pilih Minggu Ke:</span>
            <input
              type="number"
              min={1}
              max={53}
              value={weeklyWeek}
              onChange={(e) => handleWeeklyChange(parseInt(e.target.value) || 1, weeklyYear)}
              className="w-20 text-xs p-2 rounded-xl border border-gray-200 font-bold text-center"
            />
            <span className="text-xs font-bold text-gray-700">Tahun:</span>
            <input
              type="number"
              value={weeklyYear}
              onChange={(e) => handleWeeklyChange(weeklyWeek, parseInt(e.target.value) || 2026)}
              className="w-24 text-xs p-2 rounded-xl border border-gray-200 font-bold text-center"
            />
            {loadingWeekly && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Total Omzet Minggu Ini</span>
              <p className="text-2xl font-black text-[#0B3B2C] mt-1">
                {formatRupiah(weeklyData.totalRevenue)}
              </p>
              <span className="text-[11px] text-emerald-600 font-bold">
                {weeklyData.growthRate >= 0 ? `+${weeklyData.growthRate}%` : `${weeklyData.growthRate}%`} vs minggu lalu
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Laba Kotor Minggu Ini</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {formatRupiah(weeklyData.grossProfit)}
              </p>
              <span className="text-[11px] text-gray-500 font-medium">{weeklyData.totalTransactions} transaksi</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Omzet Minggu Lalu</span>
              <p className="text-2xl font-black text-gray-600 mt-1">
                {formatRupiah(weeklyData.prevTotalRevenue)}
              </p>
              <span className="text-[11px] text-gray-400 font-medium">Periode komparasi</span>
            </div>
          </div>

          {/* Breakdown Per Hari (Senin - Minggu) — tabel vertikal */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-4 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Penjualan Per Hari (Senin – Minggu)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Hari</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet (Rp)</th>
                    <th className="py-2.5 px-3 text-right">% Kontribusi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {weeklyData.daysBreakdown.map((d: any, idx: number) => {
                    const pct = weeklyData.totalRevenue > 0
                      ? ((d.total / weeklyData.totalRevenue) * 100).toFixed(1)
                      : "0.0";
                    return (
                      <tr key={d.day} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">{d.day}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">{d.count} trx</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#0B3B2C]">{formatRupiah(d.total)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 font-black text-gray-900 uppercase text-[10px]">TOTAL</td>
                    <td className="py-2.5 px-3 text-center font-black text-gray-900">
                      {weeklyData.daysBreakdown.reduce((s: number, d: any) => s + d.count, 0)} trx
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-[#0B3B2C]">
                      {formatRupiah(weeklyData.totalRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Top 10 Products Weekly */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-3 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              10 Barang Terlaris Pekanan
            </h3>
            <div className="divide-y divide-gray-200">
              {weeklyData.topProducts.map((p: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800">{i + 1}. {p.name}</span>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 mr-3">{p.qty} terjual</span>
                    <span className="font-black text-[#0B3B2C]">{formatRupiah(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. LAPORAN BULANAN                                            */}
      {/* ============================================================= */}
      {activeTab === "BULANAN" && (
        <div className="space-y-6">
          {/* SCREEN-ONLY Filter Bar */}
          <div className="print:hidden bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700">Pilih Bulan:</span>
            <select
              value={monthlyMonth}
              onChange={(e) => handleMonthlyChange(parseInt(e.target.value), monthlyYear)}
              className="text-xs p-2 rounded-xl border border-gray-200 font-bold"
            >
              {[
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
              ].map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
            <span className="text-xs font-bold text-gray-700">Tahun:</span>
            <input
              type="number"
              value={monthlyYear}
              onChange={(e) => handleMonthlyChange(monthlyMonth, parseInt(e.target.value) || 2026)}
              className="w-24 text-xs p-2 rounded-xl border border-gray-200 font-bold text-center"
            />
            {loadingMonthly && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Total Omzet Bulan Ini</span>
              <p className="text-2xl font-black text-[#0B3B2C] mt-1">
                {formatRupiah(monthlyData.totalRevenue)}
              </p>
              <span className="text-[11px] text-emerald-600 font-bold">
                {monthlyData.growthRate >= 0 ? `+${monthlyData.growthRate}%` : `${monthlyData.growthRate}%`} vs bulan lalu
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Laba Kotor Bulan Ini</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {formatRupiah(monthlyData.grossProfit)}
              </p>
              <span className="text-[11px] text-gray-500 font-medium">{monthlyData.totalTransactions} transaksi</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Barang Stok Menipis</span>
              <p className="text-2xl font-black text-orange-600 mt-1">
                {monthlyData.lowStockCount} barang
              </p>
              <span className="text-[11px] text-gray-400 font-medium">Batas stok minimum</span>
            </div>
          </div>

          {/* Rincian Penjualan Harian Bulanan */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-3 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Rincian Penjualan Harian (Tanggal 1 s/d Akhir Bulan)
            </h3>
            <div className="overflow-x-auto max-h-72 overflow-y-auto print:max-h-none print:overflow-visible print:h-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3 text-center">Jumlah Transaksi</th>
                    <th className="py-2 px-3 text-right">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyData.dailyBreakdown.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3 font-semibold text-gray-800">{d.date}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{d.count} trx</td>
                      <td className="py-2 px-3 text-right font-black text-[#0B3B2C]">{formatRupiah(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kategori Terlaris */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-3 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Kategori Barang Terlaris Bulanan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {monthlyData.topCategories.map((c: any) => (
                <div key={c.name} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <span className="text-xs font-bold text-gray-600">{c.name}</span>
                  <p className="text-base font-black text-[#0B3B2C] mt-1">{formatRupiah(c.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 4. LAPORAN TAHUNAN                                            */}
      {/* ============================================================= */}
      {activeTab === "TAHUNAN" && (
        <div className="space-y-6">
          {/* SCREEN-ONLY Filter Bar */}
          <div className="print:hidden bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700">Pilih Tahun:</span>
            <input
              type="number"
              value={yearlyYear}
              onChange={(e) => handleYearlyChange(parseInt(e.target.value) || 2026)}
              className="w-28 text-xs p-2 rounded-xl border border-gray-200 font-bold text-center"
            />
            {loadingYearly && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 print-card">
              <span className="text-xs text-gray-500 font-semibold">Total Omzet Tahun {yearlyData.year}</span>
              <p className="text-3xl font-black text-[#0B3B2C] mt-1">
                {formatRupiah(yearlyData.totalRevenue)}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-200 print-card">
              <span className="text-xs text-gray-500 font-semibold">Total Laba Kotor Tahun {yearlyData.year}</span>
              <p className="text-3xl font-black text-emerald-700 mt-1">
                {formatRupiah(yearlyData.grossProfit)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-4 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Rekapitulasi Omzet Per Bulan (Januari – Desember)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Bulan</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet (Rp)</th>
                    <th className="py-2.5 px-3 text-right">% Kontribusi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {yearlyData.monthlyBreakdown.map((m: any, idx: number) => {
                    const pct = yearlyData.totalRevenue > 0
                      ? ((m.total / yearlyData.totalRevenue) * 100).toFixed(1)
                      : "0.0";
                    return (
                      <tr key={m.month} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">{m.month}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">{m.count} trx</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#0B3B2C]">{formatRupiah(m.total)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 font-black text-gray-900 uppercase text-[10px]">TOTAL</td>
                    <td className="py-2.5 px-3 text-center font-black text-gray-900">
                      {yearlyData.monthlyBreakdown.reduce((s: number, m: any) => s + m.count, 0)} trx
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-[#0B3B2C]">
                      {formatRupiah(yearlyData.totalRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 5. LAPORAN POSISI & NILAI STOK                                */}
      {/* ============================================================= */}
      {activeTab === "STOK" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Total Nilai Persediaan (Harga Beli)</span>
              <p className="text-2xl font-black text-gray-800 mt-1">
                {formatRupiah(initialStockValuation.totalInventoryCost)}
              </p>
              <span className="text-[11px] text-gray-500 font-medium">Modal tertanam pada persediaan</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Total Nilai Penjualan (Harga Jual)</span>
              <p className="text-2xl font-black text-[#0B3B2C] mt-1">
                {formatRupiah(initialStockValuation.totalInventoryRetail)}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">Nilai jual seluruh stok fisik</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <span className="text-xs text-gray-500 font-semibold">Potensi Margin Keuntungan</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {formatRupiah(initialStockValuation.potentialProfit)}
              </p>
              <span className="text-[11px] text-gray-500 font-medium">Bila seluruh barang terjual habis</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 space-y-4 print-card">
            <h3 className="font-extrabold text-sm text-[#0B3B2C]">
              Daftar Lengkap Posisi Stok & Valuasi Persediaan
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Barang</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-center">Fisik</th>
                    <th className="py-2.5 px-3 text-center">Reserved</th>
                    <th className="py-2.5 px-3 text-center">Tersedia</th>
                    <th className="py-2.5 px-3 text-right">Harga Beli</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3 text-right">Nilai Modal (Cost)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {initialStockValuation.products.map((p: any, idx: number) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-gray-900">{p.name}</p>
                        <span className="text-[10px] text-gray-400">{p.sku}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">{p.category}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{p.stock}</td>
                      <td className="py-2.5 px-3 text-center text-blue-600 font-bold">{p.reservedStock}</td>
                      <td className="py-2.5 px-3 text-center font-black text-[#0B3B2C]">{p.availableStock}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{formatRupiah(p.costPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">{formatRupiah(p.sellPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-[#0B3B2C]">
                        {formatRupiah(p.valuationCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PRINT-ONLY SIGNATURE SECTION (PENGESAHAN DOKUMEN CETAK)       */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:block mt-4 print-break-inside-avoid print-signature">
        {/* Divider line */}
        <div className="border-t-2 border-gray-400 mb-6" />

        {/* City & Date */}
        <p className="text-xs text-right text-black mb-6 pr-2">
          Bandung, {format(new Date(), "dd MMMM yyyy", { locale: localeId })}
        </p>

        {/* Two-column signature grid */}
        <div className="grid grid-cols-2 gap-8 text-xs text-black">
          {/* Left: Kasir */}
          <div className="text-center">
            <p className="font-medium text-gray-700 leading-snug">Dibuat &amp; Diverifikasi Oleh,</p>
            <p className="font-bold text-black mt-0.5">Bagian Kasir / Operasional</p>
            <div className="border-b-2 border-black mx-8 mt-3" />
            {/* big space below the line — ruang untuk tanda tangan */}
            <p className="font-bold text-black" style={{ marginTop: "64px" }}>( ........................... )</p>
            <p className="text-[10px] text-gray-500 mt-1">Staf Koperasi</p>
          </div>

          {/* Right: Pengurus */}
          <div className="text-center">
            <p className="font-medium text-gray-700 leading-snug">Mengetahui &amp; Menyetujui,</p>
            <p className="font-bold text-black mt-0.5">Pengurus / Ketua Koperasi</p>
            <div className="border-b-2 border-black mx-8 mt-3" />
            {/* big space below the line — ruang untuk tanda tangan */}
            <p className="font-bold text-black" style={{ marginTop: "64px" }}>( ........................... )</p>
            <p className="text-[10px] text-gray-500 mt-1">Pengurus Harian</p>
          </div>
        </div>
      </div>
    </div>
  );
}
