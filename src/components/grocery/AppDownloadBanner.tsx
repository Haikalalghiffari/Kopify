import React from "react";
import { Smartphone, Download, CheckCircle2 } from "lucide-react";

export default function AppDownloadBanner() {
  return (
    <div className="bg-[#4E0D36] text-white rounded-[32px] p-8 sm:p-12 relative overflow-hidden shadow-lg my-12 flex flex-col md:flex-row items-center justify-between gap-8">
      {/* Decorative background glows */}
      <div className="absolute -left-20 -top-20 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Left Column: Text & Badges */}
      <div className="max-w-xl space-y-4 text-center md:text-left z-10">
        <span className="inline-flex items-center gap-1.5 bg-white/10 text-pink-200 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border border-white/10">
          <Smartphone className="h-3.5 w-3.5 text-[#B6F53B]" /> APLIKASI KOPERASI MOBILE
        </span>

        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight">
          Pesan Dari Rumah, Dapatkan Semua Kebutuhan Harian Lebih Cepat!
        </h2>

        <p className="text-pink-100/80 text-xs sm:text-sm leading-relaxed max-w-md">
          Pantau stok sembako, cek riwayat pesanan, dan dapatkan notifikasi langsung saat barang siap diambil di gerai koperasi.
        </p>

        {/* Store Download Badges */}
        <div className="pt-3 flex flex-wrap items-center justify-center md:justify-start gap-3">
          <button className="bg-black/90 hover:bg-black text-white px-5 py-2.5 rounded-xl flex items-center gap-2.5 border border-white/20 transition-all hover:scale-105 shadow-md">
            <span className="text-xl">▶</span>
            <div className="text-left">
              <span className="text-[10px] text-gray-400 block uppercase leading-none">Tersedia di</span>
              <span className="text-xs font-bold leading-none mt-0.5 block">Google Play</span>
            </div>
          </button>

          <button className="bg-black/90 hover:bg-black text-white px-5 py-2.5 rounded-xl flex items-center gap-2.5 border border-white/20 transition-all hover:scale-105 shadow-md">
            <span className="text-xl">🍏</span>
            <div className="text-left">
              <span className="text-[10px] text-gray-400 block uppercase leading-none">Unduh di</span>
              <span className="text-xs font-bold leading-none mt-0.5 block">App Store</span>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-center md:justify-start gap-4 text-[11px] text-pink-200/80 pt-1">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#B6F53B]" /> Notifikasi Real-time
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#B6F53B]" /> Cek Sisa SHU
          </span>
        </div>
      </div>

      {/* Right Column: Friendly Courier & Fresh Crate Graphic */}
      <div className="relative z-10 flex-shrink-0">
        <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-gradient-to-tr from-[#96381C] to-[#F97316] p-6 flex flex-col items-center justify-center text-center shadow-2xl relative border border-white/15">
          <div className="text-6xl sm:text-7xl mb-2 animate-bounce duration-1000">
            🚚
          </div>
          <span className="bg-white text-[#0B3B2C] text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-md">
            Siap Ambil & Antar
          </span>
          <span className="text-[11px] text-orange-100 mt-2 font-medium">
            Staf koperasi melayani setiap hari kerja
          </span>
        </div>
      </div>
    </div>
  );
}
