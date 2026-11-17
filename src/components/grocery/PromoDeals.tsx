import React from "react";
import { Sparkles, Tag, Award, Store } from "lucide-react";

export default function PromoDeals() {
  const deals = [
    {
      topBg: "bg-[#F7D4E6]",
      textColor: "text-[#4E0D36]",
      bottomBg: "bg-[#4E0D36]",
      label: "Harga Khusus",
      highlight: "Anggota",
      desc: "Harga sembako resmi yang lebih hemat dari toko retail umum",
      icon: Tag,
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&auto=format&fit=crop&q=80",
      itemTitle: "Beras Premium 5kg",
    },
    {
      topBg: "bg-[#FCE0CA]",
      textColor: "text-[#96381C]",
      bottomBg: "bg-[#96381C]",
      label: "Bagi Hasil",
      highlight: "SHU Tahunan",
      desc: "Setiap transaksi Anda berkontribusi pada SHU di akhir tahun",
      icon: Sparkles,
      image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=300&auto=format&fit=crop&q=80",
      itemTitle: "Sayur & Buah Segar",
    },
    {
      topBg: "bg-[#CDE2F8]",
      textColor: "text-[#0D3D68]",
      bottomBg: "bg-[#0D3D68]",
      label: "Stok Akurat",
      highlight: "Real-time",
      desc: "Jumlah barang terdata otomatis dengan stok fisik gerai",
      icon: Award,
      image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&auto=format&fit=crop&q=80",
      itemTitle: "Minyak Goreng 1L",
    },
    {
      topBg: "bg-[#EBD4F4]",
      textColor: "text-[#4E0D36]",
      bottomBg: "bg-[#4E0D36]",
      label: "Tanpa Antre",
      highlight: "Ambil di Kasir",
      desc: "Pesan dulu lewat Kopify, barang sudah siap saat Anda tiba",
      icon: Store,
      image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80",
      itemTitle: "Susu Segar Murni",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {deals.map((d, idx) => (
        <div
          key={idx}
          className="rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-[280px] hover:shadow-md hover:-translate-y-1 transition-all duration-200"
        >
          {/* Top 45% Pastel with Typography */}
          <div className={`${d.topBg} p-5 flex flex-col justify-between flex-1 relative`}>
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-xs font-semibold ${d.textColor} tracking-wide uppercase`}>
                  {d.label}
                </span>
                <p className={`text-2xl sm:text-3xl font-extrabold ${d.textColor} tracking-tight leading-none mt-0.5`}>
                  {d.highlight}
                </p>
              </div>
              <div className={`p-1.5 rounded-full bg-white/40 ${d.textColor}`}>
                <d.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[11px] text-gray-700/80 font-medium leading-snug max-w-[170px] mt-2">
              {d.desc}
            </p>
          </div>

          {/* Bottom 55% Deep jewel tone with floating product */}
          <div className={`${d.bottomBg} p-4 h-[130px] flex items-center justify-center relative overflow-hidden`}>
            <img
              src={d.image}
              alt={d.itemTitle}
              className="h-24 w-24 object-cover rounded-xl shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300"
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-white/70 font-semibold bg-black/25 px-2 py-0.5 rounded-full">
              {d.itemTitle}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
