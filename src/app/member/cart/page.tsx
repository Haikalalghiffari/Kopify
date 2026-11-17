"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatRupiah } from "@/lib/money";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Store,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitOrderAction } from "@/app/actions/orderActions";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const router = useRouter();
  const { items, updateQty, removeItem, clearCart, totalItems, totalPrice } = useCart();
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error("Keranjang belanja masih kosong.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.product.id,
          qty: i.qty,
        })),
        note,
      };

      const res = await submitOrderAction(payload);
      if (res.success) {
        toast.success(`Pesanan ${res.orderNo} berhasil dikirim! Silakan pantau statusnya.`);
        clearCart();
        router.push("/member/my-orders");
      } else {
        toast.error(res.error || "Gagal membuat pesanan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memproses pesanan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-[#EAF6EE] text-[#0B3B2C] mx-auto flex items-center justify-center mb-6">
          <ShoppingCart className="h-10 w-10 stroke-[2]" />
        </div>
        <h2 className="text-2xl font-black text-[#0B3B2C] tracking-tight mb-2">
          Keranjang Belanja Masih Kosong
        </h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto mb-8">
          Yuk, jelajahi katalog kebutuhan pokok dan sembako berkualitas dengan harga spesial khusus anggota koperasi.
        </p>
        <Link href="/member/catalog">
          <Button className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-bold px-8 py-6 rounded-2xl shadow-sm text-sm">
            Mulai Belanja di Katalog 🌿
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0B3B2C] tracking-tight">
            Keranjang Pesanan Mandiri
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Periksa rincian sembako & barang kebutuhan sebelum mengajukan pesanan ke petugas koperasi.
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Kosongkan Keranjang
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Items Table / List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 divide-y divide-gray-100">
            {items.map((item) => {
              const available = Math.max(0, item.product.stock - (item.product.reservedStock || 0));
              const subtotal = item.product.price * item.qty;

              return (
                <div key={item.product.id} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Thumbnail & Info */}
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center p-2 flex-shrink-0">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0B3B2C] leading-snug">
                        {item.product.name}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.product.unit} • SKU: {item.product.sku}
                      </p>
                      <p className="text-xs font-bold text-[#0B3B2C] mt-1">
                        {formatRupiah(item.product.price)}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Stepper & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    {/* Stepper */}
                    <div className="flex items-center gap-2 bg-[#EAF6EE] rounded-xl px-2 py-1">
                      <button
                        onClick={() => updateQty(item.product.id, item.qty - 1)}
                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#0B3B2C] hover:bg-[#0B3B2C] hover:text-white transition-colors shadow-xs"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center font-extrabold text-sm text-[#0B3B2C]">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.product.id, item.qty + 1)}
                        disabled={item.qty >= available}
                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#0B3B2C] hover:bg-[#0B3B2C] hover:text-white transition-colors shadow-xs disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right min-w-[100px]">
                      <p className="text-xs text-gray-400">Subtotal</p>
                      <p className="text-sm font-extrabold text-[#0B3B2C]">
                        {formatRupiah(subtotal)}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="p-2 text-gray-300 hover:text-red-500 rounded-xl transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-2">
            <label className="text-xs font-bold text-[#0B3B2C] flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Catatan untuk Petugas Koperasi (Opsional)
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Mohon dipilihkan sayuran yang masih sangat segar, akan diambil jam 14.00 siang..."
              className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0B3B2C] focus:border-transparent font-medium"
            />
          </div>
        </div>

        {/* Right: Checkout Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#0B3B2C] text-white rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black tracking-tight text-white flex items-center justify-between">
              <span>Ringkasan Belanja</span>
              <span className="text-xs font-bold text-[#B6F53B] bg-white/10 px-2.5 py-1 rounded-full">
                {items.length} Jenis Produk
              </span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-emerald-100/90 border-t border-b border-white/10 py-4">
              <div className="flex justify-between">
                <span>Total Item Kuantitas</span>
                <span className="font-bold text-white">{totalItems} unit</span>
              </div>
              <div className="flex justify-between">
                <span>Metode Pengambilan</span>
                <span className="font-bold text-[#B6F53B]">Ambil di Gerai (Kasir)</span>
              </div>
              <div className="flex justify-between">
                <span>Metode Pembayaran</span>
                <span className="font-bold text-white">Tunai / Transfer / Bon Kasir</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-emerald-300 uppercase tracking-wider font-bold">
                Total Estimasi Pembayaran
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#B6F53B] tracking-tight">
                {formatRupiah(totalPrice)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 text-xs text-emerald-100 space-y-1 border border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Store className="h-4 w-4 text-[#B6F53B]" />
                Alur Pemesanan Anggota:
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-200/90">
                1. Pesanan diajukan → 2. Kasir mengonfirmasi & menyiapkan barang → 3. Anggota mengambil barang di gerai & menyelesaikan pembayaran.
              </p>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full bg-[#B6F53B] hover:bg-[#a5e032] text-[#0B3B2C] font-extrabold text-sm py-6 rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                "Memproses Pengajuan..."
              ) : (
                <>
                  <span>Kirim Pesanan Sekarang</span>
                  <ArrowRight className="h-4 w-4 stroke-[3]" />
                </>
              )}
            </Button>
          </div>

          <div className="text-center">
            <Link
              href="/member/catalog"
              className="text-xs font-bold text-[#0B3B2C] hover:underline"
            >
              ← Lanjut Belanja Kebutuhan Lainnya
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
