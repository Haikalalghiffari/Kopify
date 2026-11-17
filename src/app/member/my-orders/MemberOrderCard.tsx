"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Clock,
  CheckCircle2,
  Package,
  Store,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Printer,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { cancelMemberOrderAction } from "@/app/actions/orderActions";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: any; desc: string }
> = {
  DIAJUKAN: {
    label: "Menunggu Konfirmasi",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    icon: Clock,
    desc: "Pesanan telah dikirim ke petugas koperasi dan sedang menunggu diverifikasi.",
  },
  DIKONFIRMASI: {
    label: "Dikonfirmasi",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    icon: CheckCircle2,
    desc: "Pesanan disetujui. Stok barang telah dicadangkan untuk Anda.",
  },
  DISIAPKAN: {
    label: "Sedang Dikemas",
    bg: "bg-purple-50 border-purple-200",
    text: "text-purple-800",
    icon: Package,
    desc: "Petugas koperasi sedang menyiapkan barang pesanan Anda di gerai.",
  },
  SIAP_DIAMBIL: {
    label: "Siap Diambil",
    bg: "bg-emerald-100 border-emerald-300",
    text: "text-emerald-900 font-extrabold",
    icon: Store,
    desc: "Barang sudah siap! Silakan datang ke gerai kasir koperasi untuk mengambil & membayar.",
  },
  SELESAI: {
    label: "Selesai",
    bg: "bg-[#0B3B2C]/10 border-[#0B3B2C]/20",
    text: "text-[#0B3B2C]",
    icon: CheckCircle2,
    desc: "Pesanan telah selesai dan barang telah diserahkan.",
  },
  DIBATALKAN: {
    label: "Dibatalkan",
    bg: "bg-gray-100 border-gray-200",
    text: "text-gray-600",
    icon: Ban,
    desc: "Pesanan ini telah dibatalkan.",
  },
  DITOLAK: {
    label: "Ditolak",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: XCircle,
    desc: "Pesanan ditolak oleh petugas koperasi.",
  },
};

export default function MemberOrderCard({ order }: { order: any }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const statusInfo = STATUS_CONFIG[order.status] || {
    label: order.status,
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-700",
    icon: Clock,
    desc: "",
  };

  const StatusIcon = statusInfo.icon;
  const canCancel = order.status === "DIAJUKAN";

  const handleCancel = async () => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan pesanan ${order.orderNo}?`)) {
      return;
    }

    setCancelling(true);
    try {
      const res = await cancelMemberOrderAction(order.id);
      if (res.success) {
        toast.success(`Pesanan ${order.orderNo} berhasil dibatalkan.`);
      } else {
        toast.error(res.error || "Gagal membatalkan pesanan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setCancelling(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-100/90 transition-all space-y-5">
      {/* Top Header: Order Number, Date, Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-black text-base sm:text-lg text-[#0B3B2C] tracking-tight">
              {order.orderNo}
            </span>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.text}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{statusInfo.label}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Dibuat pada {format(new Date(order.createdAt), "dd MMMM yyyy, HH:mm 'WIB'", { locale: localeId })}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] text-gray-400 block font-medium">Total Pesanan</span>
          <span className="text-lg sm:text-xl font-black text-[#0B3B2C]">
            {formatRupiah(order.total)}
          </span>
        </div>
      </div>

      {/* Status Progress Tip */}
      <div className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 text-xs text-gray-600 flex items-start gap-2.5">
        <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${statusInfo.text}`} />
        <div>
          <p className="font-semibold text-gray-800">{statusInfo.desc}</p>
          {order.rejectReason && (
            <p className="text-red-600 font-bold mt-1">
              Alasan: {order.rejectReason}
            </p>
          )}
        </div>
      </div>

      {/* Item Summary Preview (or Collapsible Detail) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">
            Daftar Barang ({order.items.length} item):
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
          >
            {expanded ? "Tutup Rincian" : "Lihat Rincian"}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {expanded ? (
          <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden bg-gray-50/40">
            {order.items.map((item: any) => (
              <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-[#0B3B2C] text-sm">
                    {item.product?.name || "Barang"}
                  </p>
                  <p className="text-gray-400 mt-0.5">
                    {item.qty} {item.product?.unit?.name || "unit"} × {formatRupiah(item.unitPrice)}
                  </p>
                </div>
                <span className="font-extrabold text-[#0B3B2C]">
                  {formatRupiah(item.qty * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 line-clamp-1">
            {order.items.map((i: any) => `${i.product?.name} (${i.qty})`).join(", ")}
          </p>
        )}

        {order.note && (
          <p className="text-xs text-gray-500 italic bg-amber-50/60 p-3 rounded-xl border border-amber-100/80">
            <strong>Catatan Anda:</strong> {order.note}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Printer className="h-3.5 w-3.5 text-gray-500" />
          <span>Cetak Bukti</span>
        </button>

        {canCancel && (
          <Button
            variant="outline"
            disabled={cancelling}
            onClick={handleCancel}
            className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl"
          >
            {cancelling ? "Membatalkan..." : "Batalkan Pesanan"}
          </Button>
        )}
      </div>
    </div>
  );
}
