"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingCart, Search, Menu, LogOut, Store, Clock } from "lucide-react";
import { signOut } from "next-auth/react";
import { useCart } from "@/context/CartContext";

export default function MemberNavbar({ user }: { user: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/member/catalog?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push("/member/catalog");
    }
  };

  return (
    <header className="bg-[#0B3B2C] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left: Hamburger + Kopify Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
            title="Menu Navigasi"
          >
            <Menu className="h-6 w-6 stroke-[2.5]" />
          </button>

          <Link href="/member/catalog" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-[#B6F53B] flex items-center justify-center text-[#0B3B2C] font-extrabold text-base shadow-sm group-hover:scale-105 transition-transform">
              🌿
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold tracking-tight text-white leading-none">
                Kopify<span className="text-[#B6F53B]">.</span>
              </span>
              <span className="text-[10px] text-emerald-300/80 font-semibold uppercase tracking-wider mt-0.5">
                Koperasi For You
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-[480px] lg:max-w-[540px] mx-4">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Cari sembako, beras, minyak, kebutuhan pokok..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white text-gray-800 placeholder-gray-400 text-xs sm:text-sm rounded-full pl-5 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[#B6F53B] shadow-inner font-medium"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 w-9 h-9 rounded-full bg-[#0B3B2C] hover:bg-[#134B39] text-white flex items-center justify-center transition-colors shadow"
              aria-label="Cari"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Right: Gerai Info + Cart + Avatar */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Operational Hours Pill (replaces delivery time) */}
          <div className="hidden xl:flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-100 border border-white/10">
            <Store className="h-3.5 w-3.5 text-[#B6F53B]" />
            <span>Gerai Koperasi Buka</span>
            <span className="text-white/40">•</span>
            <span className="text-[#B6F53B] font-bold">Ambil di Kasir</span>
          </div>

          {/* White Circular Cart Pill with Badge */}
          <Link
            href="/member/cart"
            className="relative bg-white hover:bg-emerald-50 text-[#0B3B2C] w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-all"
            title="Keranjang Pesanan"
          >
            <ShoppingCart className="h-5 w-5 stroke-[2.2]" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#F97316] text-white text-[10px] font-extrabold min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow animate-in zoom-in-50">
                {totalItems}
              </span>
            )}
          </Link>

          {/* User Profile Avatar with dropdown */}
          <Link
            href="/member/profile"
            className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-[#B6F53B] transition-all"
            title="Profil Anggota"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 bg-emerald-800 flex items-center justify-center font-bold text-white text-sm shadow">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          {/* Logout button */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hidden sm:flex p-2 text-white/70 hover:text-red-300 rounded-full hover:bg-white/10 transition-colors"
            title="Keluar"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="bg-[#07271D] px-6 py-4 space-y-4 border-t border-white/10">
          <form onSubmit={handleSearch} className="relative w-full">
            <input
              type="text"
              placeholder="Cari barang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white text-gray-800 text-sm rounded-full pl-4 pr-10 py-2.5 font-medium"
            />
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 w-8 h-8 rounded-full bg-[#0B3B2C] text-white flex items-center justify-center"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>

          <nav className="flex flex-col space-y-2 text-sm font-semibold">
            <Link
              href="/member/catalog"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/10 text-white flex items-center justify-between"
            >
              <span>🛍️ Katalog Barang</span>
              <span className="text-xs text-[#B6F53B]">Semua Produk</span>
            </Link>
            <Link
              href="/member/cart"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/10 text-white flex items-center justify-between"
            >
              <span>🛒 Keranjang Pesanan</span>
            </Link>
            <Link
              href="/member/my-orders"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/10 text-white"
            >
              📋 Riwayat Pesanan Saya
            </Link>
            <Link
              href="/member/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-white/10 text-white"
            >
              👤 Profil Anggota
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-2 rounded-xl text-left text-red-300 hover:bg-white/10 w-full"
            >
              🚪 Keluar
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
