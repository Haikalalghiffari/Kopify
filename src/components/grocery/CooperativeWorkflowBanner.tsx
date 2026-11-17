import React from "react";
import { ShoppingBag, CheckCircle, Store, Receipt, Users } from "lucide-react";

export default function CooperativeWorkflowBanner() {
  const steps = [
    {
      num: "1",
      title: "Pilih Barang",
      desc: "Lihat katalog & stok real-time dari HP atau komputer Anda.",
      icon: ShoppingBag,
    },
    {
      num: "2",
      title: "Staf Menyiapkan",
      desc: "Kasir koperasi menyiapkan barang pesanan Anda di kasir.",
      icon: CheckCircle,
    },
    {
      num: "3",
      title: "Ambil di Gerai",
      desc: "Kunjungi gerai koperasi untuk mengambil barang tanpa antre.",
      icon: Store,
    },
    {
      num: "4",
      title: "Bayar di Kasir",
      desc: "Pembayaran langsung di kasir (Tunai, Transfer, atau Bon Anggota).",
      icon: Receipt,
    },
  ];

  return (
    <div className="bg-[#0B3B2C] text-white rounded-[32px] p-8 sm:p-12 relative overflow-hidden shadow-lg my-10 border border-[#134B39]">
      <div className="max-w-4xl mx-auto text-center space-y-3 mb-10">
        <span className="inline-flex items-center gap-1.5 bg-[#B6F53B]/20 text-[#B6F53B] px-3.5 py-1 rounded-full text-xs font-bold tracking-wide border border-[#B6F53B]/30">
          <Users className="h-3.5 w-3.5" /> CARA BELANJA ANGGOTA KOPIFY
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Alur Pemesanan Mudah di Gerai Koperasi
        </h2>
        <p className="text-emerald-100/75 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
          Sistem informasi terintegrasi untuk kenyamanan seluruh anggota dan ketertiban administrasi kasir.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {steps.map((s) => (
          <div
            key={s.num}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors text-center flex flex-col items-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#B6F53B] text-[#0B3B2C] flex items-center justify-center font-extrabold text-lg mb-3 shadow">
              <s.icon className="h-6 w-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-[#B6F53B] uppercase tracking-wider mb-1">
              Langkah {s.num}
            </span>
            <h3 className="font-bold text-sm text-white mb-1.5">{s.title}</h3>
            <p className="text-xs text-emerald-100/70 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
