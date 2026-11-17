"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Boxes,
  ClipboardList,
  FileUp,
  ExternalLink,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/admin/dashboard", label: "Dasbor Utama", icon: LayoutDashboard },
  { href: "/admin/members", label: "Data Anggota", icon: Users },
  { href: "/admin/products", label: "Katalog Barang", icon: Package },
  { href: "/admin/stock", label: "Manajemen Stok", icon: Boxes },
  { href: "/admin/orders", label: "Pesanan Anggota", icon: ClipboardList },
  { href: "/admin/sales", label: "Kasir (POS)", icon: ShoppingCart },
  { href: "/admin/import", label: "Impor Excel", icon: FileUp },
  { href: "/admin/reports", label: "Laporan Keuangan", icon: FileText },
  { href: "/admin/users", label: "Manajemen Pengguna", icon: Settings },
  { href: "/admin/audit", label: "Log Aktivitas", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-[#0B3B2C] text-white border-r border-[#134B39]">
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B6F53B] flex items-center justify-center text-[#0B3B2C] font-extrabold text-xl shadow-sm">
            🛒
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white leading-none">
              Kopify<span className="text-[#B6F53B]">.</span>
            </h1>
            <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider mt-1">
              Koperasi For You • Admin
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-2">
        <Link
          href="/member/catalog"
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-emerald-100 transition-colors border border-white/5"
        >
          <span>Lihat Toko Anggota</span>
          <ExternalLink className="h-3.5 w-3.5 text-[#B6F53B]" />
        </Link>
      </div>

      <div className="px-4 py-2">
        <div className="h-[1px] bg-white/10" />
      </div>

      {/* Nav List */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  isActive
                    ? "bg-[#B6F53B] text-[#0B3B2C] shadow-sm font-bold"
                    : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-[#0B3B2C]" : "text-emerald-300")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-white/10">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-300 hover:text-red-200 hover:bg-white/10 text-xs font-semibold rounded-xl"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Keluar Sistem
        </Button>
      </div>
    </div>
  );
}
