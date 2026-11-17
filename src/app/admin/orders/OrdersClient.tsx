"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ClipboardList,
  Search,
  CheckCircle2,
  Package,
  Store,
  XCircle,
  Clock,
  Printer,
  Plus,
  Ban,
  User,
  AlertCircle,
  CreditCard,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateOrderStatusAction,
  createManualOrderAction,
} from "@/app/actions/orderActions";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

const STATUS_TABS = [
  { key: "ALL", label: "Semua Pesanan" },
  { key: "DIAJUKAN", label: "Menunggu Konfirmasi" },
  { key: "DIKONFIRMASI", label: "Dikonfirmasi (Reserved)" },
  { key: "DISIAPKAN", label: "Sedang Dikemas" },
  { key: "SIAP_DIAMBIL", label: "Siap Diambil" },
  { key: "SELESAI", label: "Selesai & Lunas" },
  { key: "BATAL_TOLAK", label: "Ditolak / Batal" },
];

export default function OrdersClient({
  orders,
  members,
  products,
}: {
  orders: any[];
  members: any[];
  products: any[];
}) {
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalOrder, setRejectModalOrder] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Complete & Pay Modal State
  const [completeModalOrder, setCompleteModalOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.TUNAI);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.LUNAS);

  // Manual Order Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualMemberId, setManualMemberId] = useState("");
  const [manualItems, setManualItems] = useState<{ productId: string; qty: number }[]>([
    { productId: products[0]?.id || "", qty: 1 },
  ]);
  const [manualNote, setManualNote] = useState("");

  // Filtering
  const filteredOrders = orders.filter((o) => {
    // Status Tab filter
    if (activeTab === "BATAL_TOLAK") {
      if (o.status !== "DITOLAK" && o.status !== "DIBATALKAN") return false;
    } else if (activeTab !== "ALL" && o.status !== activeTab) {
      return false;
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNo = o.orderNo.toLowerCase().includes(q);
      const matchMember = o.member?.name.toLowerCase().includes(q);
      const matchMemberNo = o.member?.memberNo.toLowerCase().includes(q);
      return matchNo || matchMember || matchMemberNo;
    }

    return true;
  });

  const pendingCount = orders.filter((o) => o.status === "DIAJUKAN").length;

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    options?: {
      rejectReason?: string;
      paymentMethod?: PaymentMethod;
      paymentStatus?: PaymentStatus;
    }
  ) => {
    setLoadingId(orderId);
    try {
      const res = await updateOrderStatusAction({
        orderId,
        newStatus,
        rejectReason: options?.rejectReason,
        paymentMethod: options?.paymentMethod,
        paymentStatus: options?.paymentStatus,
      });

      if (res.success) {
        toast.success(`Status pesanan berhasil diperbarui ke: ${newStatus}`);
        setRejectModalOrder(null);
        setCompleteModalOrder(null);
        setRejectReason("");
      } else {
        toast.error(res.error || "Gagal memperbarui status.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMemberId) {
      toast.error("Pilih anggota terlebih dahulu");
      return;
    }

    const validItems = manualItems.filter((i) => i.productId && i.qty > 0);
    if (validItems.length === 0) {
      toast.error("Tambahkan minimal 1 barang");
      return;
    }

    try {
      const res = await createManualOrderAction({
        memberId: manualMemberId,
        items: validItems,
        note: manualNote,
      });

      if (res.success) {
        toast.success(`Pesanan ${res.order?.orderNo} berhasil dibuat atas nama anggota!`);
        setManualModalOpen(false);
        setManualMemberId("");
        setManualItems([{ productId: products[0]?.id || "", qty: 1 }]);
        setManualNote("");
      } else {
        toast.error(res.error || "Gagal membuat pesanan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pesanan.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B3B2C] tracking-tight">
            Manajemen Pesanan Anggota
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Konfirmasi pesanan masuk, alokasi stok cadangan (reserved), dan selesaikan transaksi kasir.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setManualModalOpen(true)}
            className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-bold text-xs rounded-xl px-4 py-2 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Pesanan Manual (Kasir)</span>
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-[#0B3B2C] text-white shadow-xs"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{tab.label}</span>
                {tab.key === "DIAJUKAN" && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor pesanan (ORD-...), nama anggota, atau no. anggota..."
            className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0B3B2C]"
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <ClipboardList className="h-10 w-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">Tidak ada data pesanan</p>
            <p className="text-xs">Ubah filter status atau kata kunci pencarian Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B3B2C]/5 text-[#0B3B2C] uppercase tracking-wider font-extrabold text-[11px] border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">No. Pesanan</th>
                  <th className="py-3.5 px-4">Anggota</th>
                  <th className="py-3.5 px-4">Barang</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Status Alur</th>
                  <th className="py-3.5 px-4 text-right">Aksi Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const isLoading = loadingId === order.id;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Order No & Date */}
                      <td className="py-4 px-4 align-top">
                        <span className="font-extrabold text-gray-900 block font-mono">
                          {order.orderNo}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5 block">
                          {format(new Date(order.createdAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                        </span>
                        {order.note && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block border border-amber-200/60 max-w-[180px] truncate" title={order.note}>
                            📝 {order.note}
                          </span>
                        )}
                      </td>

                      {/* Member Info */}
                      <td className="py-4 px-4 align-top">
                        <span className="font-bold text-gray-800 block">
                          {order.member?.name || "-"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {order.member?.memberNo} • {order.member?.phone || ""}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 align-top max-w-xs">
                        <div className="space-y-1">
                          {order.items.map((it: any) => (
                            <div key={it.id} className="text-[11px] flex items-center justify-between gap-2">
                              <span className="text-gray-700 font-medium truncate">
                                {it.product?.name}
                              </span>
                              <span className="text-gray-400 whitespace-nowrap">
                                {it.qty} {it.product?.unit?.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4 align-top">
                        <span className="font-black text-sm text-[#0B3B2C] block">
                          {formatRupiah(order.total)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            order.status === "DIAJUKAN"
                              ? "bg-amber-100 text-amber-900"
                              : order.status === "DIKONFIRMASI"
                              ? "bg-blue-100 text-blue-900"
                              : order.status === "DISIAPKAN"
                              ? "bg-purple-100 text-purple-900"
                              : order.status === "SIAP_DIAMBIL"
                              ? "bg-emerald-100 text-emerald-900 font-extrabold"
                              : order.status === "SELESAI"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {order.status === "DIAJUKAN" && <Clock className="h-3 w-3" />}
                          {order.status === "DIKONFIRMASI" && <CheckCircle2 className="h-3 w-3" />}
                          {order.status === "DISIAPKAN" && <Package className="h-3 w-3" />}
                          {order.status === "SIAP_DIAMBIL" && <Store className="h-3 w-3" />}
                          {order.status === "SELESAI" && <CheckCircle2 className="h-3 w-3" />}
                          {(order.status === "DITOLAK" || order.status === "DIBATALKAN") && (
                            <XCircle className="h-3 w-3" />
                          )}
                          <span>{order.status}</span>
                        </span>
                        {order.rejectReason && (
                          <span className="text-[10px] text-red-600 block mt-1">
                            Alasan: {order.rejectReason}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons based on state machine */}
                      <td className="py-4 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Print Slip */}
                          <button
                            onClick={() => window.print()}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                            title="Cetak Surat Pesanan"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          {order.status === OrderStatus.DIAJUKAN && (
                            <>
                              <button
                                disabled={isLoading}
                                onClick={() => handleUpdateStatus(order.id, OrderStatus.DIKONFIRMASI)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                              >
                                {isLoading ? "..." : "✓ Konfirmasi"}
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={() => setRejectModalOrder(order)}
                                className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-[11px]"
                              >
                                Tolak
                              </button>
                            </>
                          )}

                          {order.status === OrderStatus.DIKONFIRMASI && (
                            <button
                              disabled={isLoading}
                              onClick={() => handleUpdateStatus(order.id, OrderStatus.DISIAPKAN)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px]"
                            >
                              {isLoading ? "..." : "Kemas Barang →"}
                            </button>
                          )}

                          {order.status === OrderStatus.DISIAPKAN && (
                            <button
                              disabled={isLoading}
                              onClick={() => handleUpdateStatus(order.id, OrderStatus.SIAP_DIAMBIL)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            >
                              {isLoading ? "..." : "Siap Diambil ✓"}
                            </button>
                          )}

                          {order.status === OrderStatus.SIAP_DIAMBIL && (
                            <button
                              disabled={isLoading}
                              onClick={() => setCompleteModalOrder(order)}
                              className="px-3 py-1.5 rounded-xl bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-extrabold text-[11px] shadow-xs"
                            >
                              Selesaikan & Bayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Reject Reason Modal */}
      {rejectModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-extrabold text-base text-gray-900">
              Tolak Pesanan {rejectModalOrder.orderNo}
            </h3>
            <p className="text-xs text-gray-500">
              Masukkan alasan penolakan agar anggota mendapatkan penjelasan yang jelas.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Stok barang di gerai sedang rusak atau habis..."
              className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectModalOrder(null)}
                className="text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={() =>
                  handleUpdateStatus(rejectModalOrder.id, OrderStatus.DITOLAK, {
                    rejectReason,
                  })
                }
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Konfirmasi Tolak
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Complete & Pay Modal */}
      {completeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-5">
            <h3 className="font-extrabold text-base text-[#0B3B2C]">
              Penyelesaian Pesanan {completeModalOrder.orderNo}
            </h3>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs space-y-1">
              <p className="text-gray-500">Total yang harus dibayar:</p>
              <p className="text-2xl font-black text-[#0B3B2C]">
                {formatRupiah(completeModalOrder.total)}
              </p>
              <p className="text-[11px] text-gray-500 pt-1">
                Anggota: <strong>{completeModalOrder.member?.name}</strong> ({completeModalOrder.member?.memberNo})
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 font-semibold"
                >
                  <option value={PaymentMethod.TUNAI}>Tunai (Cash)</option>
                  <option value={PaymentMethod.TRANSFER}>Transfer Bank / QRIS</option>
                  <option value={PaymentMethod.DICATAT}>Dicatat (Kompensasi)</option>
                  <option value={PaymentMethod.BON}>Bon / Kredit Anggota</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Status Pembayaran
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 font-semibold"
                >
                  <option value={PaymentStatus.LUNAS}>Lunas</option>
                  <option value={PaymentStatus.BELUM_LUNAS}>Belum Lunas (Piutang Bon)</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              *Saat diselesaikan, stok fisik barang akan otomatis dipotong, saldo reservasi dilepas, dan transaksi penjualan tercatat di buku kas.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCompleteModalOrder(null)}
                className="text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={() =>
                  handleUpdateStatus(completeModalOrder.id, OrderStatus.SELESAI, {
                    paymentMethod,
                    paymentStatus,
                  })
                }
                className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] text-xs font-black rounded-xl"
              >
                Selesaikan Transaksi ✓
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Order Creation Modal (FR-5.9) */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateManualOrder}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="font-extrabold text-base text-[#0B3B2C]">
              Buat Pesanan Atas Nama Anggota (Telepon / Kasir)
            </h3>

            {/* Member selector */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Pilih Anggota *
              </label>
              <select
                value={manualMemberId}
                onChange={(e) => setManualMemberId(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200"
              >
                <option value="">-- Pilih Anggota Koperasi --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNo} — {m.name} ({m.phone || "No HP -"})
                  </option>
                ))}
              </select>
            </div>

            {/* Items selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700">Barang Pesanan *</label>
                <button
                  type="button"
                  onClick={() =>
                    setManualItems([...manualItems, { productId: products[0]?.id || "", qty: 1 }])
                  }
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Tambah Barang
                </button>
              </div>

              {manualItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      const updated = [...manualItems];
                      updated[idx].productId = e.target.value;
                      setManualItems(updated);
                    }}
                    className="flex-1 text-xs p-2 rounded-xl border border-gray-200"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit?.name}) — Sisa: {p.stock - p.reservedStock}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => {
                      const updated = [...manualItems];
                      updated[idx].qty = parseInt(e.target.value) || 1;
                      setManualItems(updated);
                    }}
                    className="w-20 text-xs p-2 rounded-xl border border-gray-200 text-center"
                    placeholder="Qty"
                  />
                  {manualItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setManualItems(manualItems.filter((_, i) => i !== idx))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Catatan Petugas (Opsional)
              </label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Misal: Pesan via WhatsApp minta disiapkan jam 12"
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setManualModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] text-xs font-bold rounded-xl"
              >
                Simpan Pesanan
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
