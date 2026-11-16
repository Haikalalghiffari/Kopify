"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  ShoppingBag,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  UserCog,
  History,
  LogOut,
  Menu,
  X,
  Store,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Anggota", href: "/admin/members", icon: Users },
  { label: "Barang & Kategori", href: "/admin/products", icon: Package },
  { label: "Manajemen Stok", href: "/admin/stock", icon: Layers },
  { label: "Pesanan Masuk", href: "/admin/orders", icon: ShoppingBag },
  { label: "Kasir (POS)", href: "/admin/sales", icon: Receipt },
  { label: "Impor Excel", href: "/admin/import", icon: FileSpreadsheet, adminOnly: true },
  { label: "Laporan", href: "/admin/reports", icon: BarChart3 },
  { label: "Manajemen User", href: "/admin/users", icon: UserCog, adminOnly: true },
  { label: "Audit Aktivitas", href: "/admin/audit", icon: History, adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const role = session?.user?.role;
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (role !== "ADMIN" && role !== "KASIR") return;
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/orders/pending-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setPendingCount(Number(data.count) || 0);
      } catch {
        // abaikan, badge hanya pelengkap
      }
    }

    load();
    const timer = setInterval(load, 30000); // segarkan tiap 30 detik
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [role, pathname]);

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || role === "ADMIN"
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-800 text-sm">Koperasi App</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static flex flex-col justify-between",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div>
          {/* Logo / Brand */}
          <div className="h-16 flex items-center space-x-3 px-6 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm tracking-wide">Koperasi System</h1>
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium">
                Panel {role === "ADMIN" ? "Administrator" : "Kasir"}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.href === "/admin/orders" && pendingCount > 0 && (
                    <span className="ml-auto min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold text-center">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">
                {session?.user?.name || session?.user?.username || "Pengguna"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {session?.user?.email}
              </p>
            </div>
            {role && <StatusBadge status={role} variant="info" className="text-[10px] py-0 px-2" />}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-900/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="text-sm text-slate-500">
            Sistem Informasi Koperasi <span className="mx-2 text-slate-300">/</span>{" "}
            <span className="font-medium text-slate-800 capitalize">
              {pathname.split("/")[2] || "Dashboard"}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-600">
            <span>Zona Waktu: <strong className="text-slate-800">Asia/Jakarta (WIB)</strong></span>
          </div>
        </header>

        <div className="p-6 md:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}