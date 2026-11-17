import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/money";
import {
  Users,
  Package,
  ShoppingCart,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
} from "lucide-react";
import Link from "next/link";
import SalesTrendChart from "@/components/dashboard/SalesTrendChart";
import DashboardWidgets from "@/components/dashboard/DashboardWidgets";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  // Date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    memberCount,
    productCount,
    pendingOrders,
    todaySales,
    monthSales,
    trendSales,
    rawTopProducts,
    topStockProducts,
    lowStockProducts,
  ] = await Promise.all([
    db.member.count({ where: { status: "AKTIF", deletedAt: null } }),
    db.product.count({ where: { isActive: true, deletedAt: null } }),
    db.order.count({ where: { status: "DIAJUKAN" } }),
    db.sale.aggregate({
      where: { status: "AKTIF", soldAt: { gte: today } },
      _sum: { total: true },
      _count: { id: true },
    }),
    db.sale.aggregate({
      where: { status: "AKTIF", soldAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    db.sale.findMany({
      where: { status: "AKTIF", soldAt: { gte: thirtyDaysAgo } },
      select: { soldAt: true, total: true },
      orderBy: { soldAt: "asc" },
    }),
    db.saleItem.findMany({
      where: { sale: { status: "AKTIF" } },
      include: {
        product: { include: { unit: true } },
      },
      take: 200,
    }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: { unit: true },
      orderBy: { stock: "desc" },
      take: 10,
    }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: { category: true, unit: true },
      orderBy: { stock: "asc" },
    }),
  ]);

  // Aggregate 30-day trend chart
  const dateMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getDate()}/${d.getMonth() + 1}`;
    dateMap[key] = 0;
  }
  for (const s of trendSales) {
    const d = new Date(s.soldAt);
    const key = `${d.getDate()}/${d.getMonth() + 1}`;
    if (dateMap[key] !== undefined) {
      dateMap[key] += s.total;
    }
  }
  const chartData = Object.entries(dateMap).map(([date, total]) => ({ date, total }));

  // Aggregate top products
  const productAggMap: Record<string, { name: string; sku: string; qty: number; revenue: number; unit: string }> = {};
  for (const item of rawTopProducts) {
    const pid = item.productId;
    if (!productAggMap[pid]) {
      productAggMap[pid] = {
        name: item.product?.name || "Barang",
        sku: item.product?.sku || "-",
        unit: item.product?.unit?.name || "unit",
        qty: 0,
        revenue: 0,
      };
    }
    productAggMap[pid].qty += item.qty;
    productAggMap[pid].revenue += item.unitPrice * item.qty;
  }
  const topProductsList = Object.values(productAggMap);

  // Top stock
  const topStockList = topStockProducts.map((p) => ({
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    unit: p.unit.name,
    valueCost: p.stock * p.costPrice,
  }));

  // Low stock
  const lowStock = lowStockProducts.filter((p) => p.stock <= p.minStock);

  const stats = [
    {
      title: "Omzet Hari Ini",
      value: formatRupiah(todaySales._sum.total ?? 0),
      subtitle: `${todaySales._count.id} transaksi kasir`,
      icon: ShoppingCart,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      title: "Omzet Bulan Ini",
      value: formatRupiah(monthSales._sum.total ?? 0),
      subtitle: `Sejak 1 ${now.toLocaleString("id-ID", { month: "short" })}`,
      icon: TrendingUp,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      title: "Pesanan Menunggu",
      value: pendingOrders.toString(),
      subtitle: "Perlu konfirmasi petugas",
      icon: Clock,
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      title: "Barang Stok Menipis",
      value: lowStock.length.toString(),
      subtitle: "Di bawah batas minimum",
      icon: AlertTriangle,
      color: "text-rose-700",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B3B2C] tracking-tight">
            Dasbor Analitik Kopify
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Selamat datang kembali, <strong>{session?.user?.name || "Pengurus"}</strong>. Pantau metrik penjualan dan pergerakan stok harian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/reports"
            className="px-4 py-2 rounded-xl bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <FileText className="h-4 w-4" />
            <span>Buka Laporan Keuangan</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100 flex items-center gap-4"
          >
            <div className={`p-3.5 rounded-2xl ${stat.bg} ${stat.color} flex-shrink-0`}>
              <stat.icon className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-semibold block">{stat.title}</span>
              <p className="text-xl sm:text-2xl font-black text-[#0B3B2C] mt-0.5">{stat.value}</p>
              <span className="text-[11px] text-gray-500 font-medium block">{stat.subtitle}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 30-Day Sales Trend Chart (PRD 6.7) */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-[#0B3B2C]">
              Tren Omzet Penjualan (30 Hari Terakhir)
            </h3>
            <p className="text-xs text-gray-400">Total akumulasi transaksi kasir & pesanan selesai</p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            Real-Time
          </span>
        </div>

        <SalesTrendChart data={chartData} />
      </div>

      {/* Top Products & Top Stock Widgets (PRD 6.7) */}
      <DashboardWidgets topProducts={topProductsList} topStock={topStockList} />

      {/* Low Stock Alert Table */}
      {lowStock.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-extrabold text-sm">
                Peringatan Stok Menipis ({lowStock.length} barang)
              </h3>
            </div>
            <Link
              href="/admin/stock"
              className="text-xs font-bold text-rose-800 hover:underline"
            >
              Kelola di Manajemen Stok →
            </Link>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl border border-rose-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/50 text-rose-900 font-bold uppercase text-[10px] border-b border-rose-100">
                <tr>
                  <th className="py-2.5 px-3">Barang</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Sisa Stok Fisik</th>
                  <th className="py-2.5 px-3 text-right">Batas Minimum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {lowStock.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-gray-900">{p.name}</p>
                      <span className="text-[10px] text-gray-400">{p.sku}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">{p.category?.name}</td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-600">
                      {p.stock} {p.unit?.name}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-500 font-bold">
                      {p.minStock} {p.unit?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
