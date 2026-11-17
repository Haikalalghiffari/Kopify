"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/money";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  User,
  Users,
  CreditCard,
  Banknote,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { processDirectSaleAction } from "@/app/actions/saleActions";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

interface CartLine {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  stock: number;
  qty: number;
}

export default function SalesClient({
  products,
  members,
  categories,
  recentSales,
}: {
  products: any[];
  members: any[];
  categories: any[];
  recentSales: any[];
}) {
  const [activeView, setActiveView] = useState<"POS" | "HISTORY">("POS");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // POS State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.TUNAI);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.LUNAS);
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      return matchName || matchSku;
    }
    return true;
  });

  const addToCart = (product: any) => {
    const available = product.stock;
    if (available <= 0) {
      toast.error(`Stok ${product.name} habis`);
      return;
    }

    setCart((prev) => {
      const exist = prev.find((item) => item.productId === product.id);
      if (exist) {
        if (exist.qty + 1 > available) {
          toast.error(`Sisa stok hanya ${available} ${product.unit?.name}`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit?.name || "unit",
            price: product.sellPrice,
            stock: product.stock,
            qty: 1,
          },
        ];
      }
    });
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }

    setCart((prev) => {
      const exist = prev.find((item) => item.productId === productId);
      if (!exist) return prev;
      if (newQty > exist.stock) {
        toast.error(`Stok maksimal: ${exist.stock} ${exist.unit}`);
        return prev;
      }
      return prev.map((item) =>
        item.productId === productId ? { ...item, qty: newQty } : item
      );
    });
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCashGiven(0);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const change = Math.max(0, cashGiven - grandTotal);

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kasir masih kosong");
      return;
    }

    if (paymentMethod === PaymentMethod.TUNAI && cashGiven > 0 && cashGiven < grandTotal) {
      toast.error("Nominal uang tunai kurang dari total belanja");
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        memberId: selectedMemberId || null,
        items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
        discount,
        paymentMethod,
        paymentStatus,
      };

      const res = await processDirectSaleAction(payload);
      if (res.success && res.sale) {
        toast.success(`Transaksi ${res.sale.saleNo} berhasil diproses!`);
        setReceiptData({
          sale: res.sale,
          cashGiven: paymentMethod === PaymentMethod.TUNAI && cashGiven > 0 ? cashGiven : grandTotal,
          change: paymentMethod === PaymentMethod.TUNAI && cashGiven > 0 ? change : 0,
        });
        clearCart();
      } else {
        toast.error(res.error || "Gagal memproses transaksi kasir.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B3B2C] tracking-tight flex items-center gap-2">
            <span>🛒 Mesin Kasir POS</span>
            <span className="text-xs bg-[#B6F53B] text-[#0B3B2C] font-extrabold px-2.5 py-0.5 rounded-full">
              Kopify Mart
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Pencatatan transaksi penjualan langsung di gerai koperasi (anggota maupun pelanggan umum).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveView("POS")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === "POS"
                ? "bg-[#0B3B2C] text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Kasir Aktif
          </button>
          <button
            onClick={() => setActiveView("HISTORY")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === "HISTORY"
                ? "bg-[#0B3B2C] text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Riwayat Hari Ini ({recentSales.length})
          </button>
        </div>
      </div>

      {activeView === "POS" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Product Catalog & Search (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search and Category Filter */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ketik SKU barcode atau nama produk sembako..."
                  className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0B3B2C]"
                />
                <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
              </div>

              {/* Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === "ALL"
                      ? "bg-[#0B3B2C] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Semua
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === c.id
                        ? "bg-[#0B3B2C] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs flex flex-col justify-between transition-all select-none ${
                      isOutOfStock
                        ? "opacity-40 cursor-not-allowed bg-gray-50"
                        : "hover:border-emerald-500 hover:shadow-md cursor-pointer active:scale-98"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium mb-1">
                        <span>{p.sku}</span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? "bg-red-100 text-red-600"
                              : p.stock <= p.minStock
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          Stok: {p.stock}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-gray-900 leading-snug line-clamp-2">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {p.unit?.name}
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between">
                      <span className="font-black text-sm text-[#0B3B2C]">
                        {formatRupiah(p.sellPrice)}
                      </span>
                      <button
                        disabled={isOutOfStock}
                        className="w-7 h-7 rounded-lg bg-[#EAF6EE] text-[#0B3B2C] flex items-center justify-center font-black hover:bg-[#0B3B2C] hover:text-white transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: POS Checkout Panel (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-5">
            {/* Customer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>Pelanggan</span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  {selectedMemberId ? "Terhubung ke Anggota" : "Pelanggan Umum"}
                </span>
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 font-medium"
              >
                <option value="">-- Pelanggan Umum (Non-Anggota) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNo} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 pb-1 border-b border-gray-100">
                <span>Daftar Belanja ({cart.length} item)</span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-red-500 hover:text-red-700 text-[11px] font-semibold"
                  >
                    Reset
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center text-gray-400 space-y-1">
                  <ShoppingCart className="h-8 w-8 mx-auto text-gray-300 stroke-[1.5]" />
                  <p className="text-xs font-semibold">Belum ada barang di kasir</p>
                  <p className="text-[11px]">Klik produk di sebelah kiri untuk memasukkan.</p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {formatRupiah(item.price)} / {item.unit}
                        </p>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1">
                        <button
                          onClick={() => updateCartQty(item.productId, item.qty - 1)}
                          className="w-5 h-5 rounded bg-white text-gray-700 flex items-center justify-center hover:bg-gray-200"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-6 text-center font-bold">{item.qty}</span>
                        <button
                          onClick={() => updateCartQty(item.productId, item.qty + 1)}
                          className="w-5 h-5 rounded bg-white text-gray-700 flex items-center justify-center hover:bg-gray-200"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="font-extrabold text-gray-900">
                          {formatRupiah(item.price * item.qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Details */}
            <div className="space-y-3 pt-3 border-t border-gray-100 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">{formatRupiah(subtotal)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">Diskon (Rp)</span>
                <input
                  type="number"
                  min={0}
                  value={discount === 0 ? "" : discount}
                  onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-28 text-right p-1.5 rounded-lg border border-gray-200 font-bold text-xs"
                />
              </div>

              {/* Grand Total */}
              <div className="p-3.5 rounded-2xl bg-[#0B3B2C] text-white flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                    Total Bayar
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#B6F53B]">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
                <div className="text-right text-[10px] text-emerald-100">
                  {cart.length} item • {cart.reduce((s, i) => s + i.qty, 0)} qty
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    Metode Bayar
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2 rounded-xl border border-gray-200 text-xs font-semibold"
                  >
                    <option value={PaymentMethod.TUNAI}>Tunai (Cash)</option>
                    <option value={PaymentMethod.TRANSFER}>Transfer / QRIS</option>
                    <option value={PaymentMethod.DICATAT}>Dicatat</option>
                    <option value={PaymentMethod.BON}>Bon / Kredit</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    Status Bayar
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full p-2 rounded-xl border border-gray-200 text-xs font-semibold"
                  >
                    <option value={PaymentStatus.LUNAS}>Lunas</option>
                    <option value={PaymentStatus.BELUM_LUNAS}>Belum Lunas</option>
                  </select>
                </div>
              </div>

              {/* Cash given & Change (if Tunai) */}
              {paymentMethod === PaymentMethod.TUNAI && (
                <div className="space-y-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700">Uang Tunai (Rp)</span>
                    <input
                      type="number"
                      min={0}
                      value={cashGiven === 0 ? "" : cashGiven}
                      onChange={(e) => setCashGiven(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder={grandTotal.toString()}
                      className="w-32 text-right p-1.5 rounded-lg border border-gray-200 font-black text-xs text-[#0B3B2C]"
                    />
                  </div>

                  {/* Quick cash pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                    <button
                      onClick={() => setCashGiven(grandTotal)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                    >
                      Uang Pas
                    </button>
                    {[50000, 100000, 150000, 200000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashGiven(amt)}
                        className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                      >
                        {formatRupiah(amt)}
                      </button>
                    ))}
                  </div>

                  {cashGiven > 0 && (
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-200 font-extrabold text-[#0B3B2C]">
                      <span>Kembalian</span>
                      <span className={cashGiven < grandTotal ? "text-red-600" : "text-emerald-700"}>
                        {cashGiven < grandTotal
                          ? `Kurang ${formatRupiah(grandTotal - cashGiven)}`
                          : formatRupiah(change)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Checkout Button */}
              <Button
                onClick={handleProcessSale}
                disabled={isProcessing || cart.length === 0}
                className="w-full bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-black text-xs sm:text-sm py-5 rounded-2xl shadow-sm transition-all active:scale-98"
              >
                {isProcessing ? "Menyimpan Transaksi..." : "Proses Pembayaran & Selesai ✓"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* HISTORY TAB */
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 space-y-4">
          <h3 className="font-extrabold text-base text-[#0B3B2C]">
            Riwayat Transaksi Penjualan Hari Ini
          </h3>

          {recentSales.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">
              Belum ada transaksi penjualan yang tercatat hari ini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">No. Penjualan</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Metode Bayar</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {s.saleNo}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {format(new Date(s.soldAt), "HH:mm 'WIB'", { locale: localeId })}
                      </td>
                      <td className="py-3 px-4">
                        {s.member ? (
                          <span className="font-bold text-emerald-800">
                            {s.member.name} ({s.member.memberNo})
                          </span>
                        ) : (
                          <span className="text-gray-500">Pelanggan Umum</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-gray-900">
                        {formatRupiah(s.total)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                          {s.paymentMethod} • {s.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setReceiptData({ sale: s, cashGiven: s.total, change: 0 })}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                          title="Cetak Ulang Struk"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECEIPT MODAL (Thermal Receipt Print Layout) */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 font-mono text-xs">
            {/* Thermal Slip Content */}
            <div id="receipt-print" className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 space-y-3">
              <div className="text-center space-y-0.5">
                <h2 className="font-black text-sm tracking-tight text-gray-900">
                  KOPIFY MART 🌿
                </h2>
                <p className="text-[10px] text-gray-500">Koperasi Konsumen Indonesia</p>
                <p className="text-[9px] text-gray-400">Jl. Koperasi Makmur Bersama No. 1</p>
              </div>

              <div className="border-t border-b border-dashed border-gray-300 py-2 space-y-1 text-[10px] text-gray-600">
                <div className="flex justify-between">
                  <span>No: {receiptData.sale.saleNo}</span>
                  <span>{format(new Date(receiptData.sale.soldAt || new Date()), "dd/MM/yy HH:mm")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir: {receiptData.sale.createdBy?.username || "Kasir"}</span>
                  <span>{receiptData.sale.member?.name || "Umum"}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 py-1 text-[11px]">
                {receiptData.sale.items?.map((it: any) => (
                  <div key={it.id}>
                    <p className="font-bold text-gray-900">{it.product?.name}</p>
                    <div className="flex justify-between text-gray-500 text-[10px]">
                      <span>
                        {it.qty} {it.product?.unit?.name || "x"} @ {formatRupiah(it.unitPrice)}
                      </span>
                      <span className="font-bold text-gray-900">
                        {formatRupiah(it.qty * it.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(receiptData.sale.total + (receiptData.sale.discount || 0))}</span>
                </div>
                {receiptData.sale.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Diskon</span>
                    <span>-{formatRupiah(receiptData.sale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs text-gray-900 pt-1 border-t border-gray-200">
                  <span>TOTAL</span>
                  <span>{formatRupiah(receiptData.sale.total)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                  <span>Bayar ({receiptData.sale.paymentMethod})</span>
                  <span>{formatRupiah(receiptData.cashGiven)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Kembalian</span>
                  <span>{formatRupiah(receiptData.change)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-dashed border-gray-300">
                <p>Terima kasih atas kunjungan Anda!</p>
                <p>Belanja di Koperasi, Sejahtera Bersama.</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setReceiptData(null)}
                className="text-xs rounded-xl"
              >
                Tutup
              </Button>
              <Button
                onClick={() => window.print()}
                className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Cetak Struk
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
