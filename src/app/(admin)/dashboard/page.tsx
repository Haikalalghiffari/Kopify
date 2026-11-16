import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Store, CheckCircle2, ShieldCheck, Database, Layers } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 bg-gradient-to-r from-emerald-700 to-emerald-900 rounded-2xl text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 mb-2">
            Sprint 1: Fondasi Teknis Siap
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Selamat Datang, {session?.user?.name || session?.user?.username}!
          </h1>
          <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl">
            Fondasi arsitektur Sistem Informasi Koperasi telah aktif. Modul P2, P3, P4,
            dan P5 dapat dikembangkan secara modular pada branch masing-masing.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 backdrop-blur-sm">
          <Store className="w-5 h-5 text-emerald-300" />
          <div className="text-left text-xs">
            <p className="font-semibold text-white">Status Fondasi</p>
            <p className="text-emerald-200">Database & RBAC Aktif</p>
          </div>
        </div>
      </div>

      {/* Grid Informasi Status Fondasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">Prisma Schema & Database</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            14 entitas PRD telah dimodelkan dengan integer rupiah, soft delete, relasi foreign key,
            dan indeks performa WIB.
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">Auth.js & RBAC Server-Side</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Proteksi middleware dan server-side helpers (requireRole, requireAuth) dengan 3 role:
            Admin, Kasir, dan Anggota.
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">Komponen & Kontrak Bersama</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            DataTable, FormField, ConfirmDialog, Toast, Modal, formatRupiah, date WIB, dan stub
            stockService siap digunakan tim.
          </p>
        </div>
      </div>

      {/* Petunjuk Lanjutan Tim */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Panduan Pengembang Modul (P2 - P5)</span>
        </h2>
        <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5 leading-relaxed">
          <li><strong>P2 (Master Data & Stok):</strong> Kembangkan halaman di <code>/admin/members</code>, <code>/admin/products</code>, dan <code>/admin/stock</code>. Implementasikan <code>stockService</code> sesuai kontrak di <code>src/services/contracts.ts</code>.</li>
          <li><strong>P3 (Impor Excel):</strong> Kembangkan wizard impor di <code>/admin/import</code> menggunakan template dan model <code>import_logs</code>.</li>
          <li><strong>P4 (Pesanan & Penjualan):</strong> Kembangkan modul POS di <code>/admin/sales</code> dan kelola status pesanan di <code>/admin/orders</code>.</li>
          <li><strong>P5 (Dashboard & Laporan):</strong> Pasang analitik widget di halaman ini dan 4 laporan periodik di <code>/admin/reports</code>.</li>
        </ul>
      </div>
    </div>
  );
}
