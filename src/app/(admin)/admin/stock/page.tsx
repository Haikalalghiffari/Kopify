"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ClipboardList, PackagePlus } from "lucide-react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FormField, Input } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/components/shared/Toast";
import { formatDateWIB } from "@/lib/date";
import { PaginationMeta } from "@/lib/pagination";

type StockAction = "RECEIVE" | "OPNAME";

interface StockProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  reservedStock: number;
  minStock: number;
  unit: { name: string };
}

interface StockMovement {
  id: string;
  type: string;
  qtyChange: number;
  stockBefore: number;
  stockAfter: number;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: string;
  product: StockProduct;
  user: { username: string } | null;
}

interface StockListResponse {
  data: StockMovement[];
  products: StockProduct[];
  meta: PaginationMeta;
}

function getErrorMessage(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return "Permintaan gagal. Silakan coba lagi.";
}

function movementLabel(type: string): string {
  const labels: Record<string, string> = {
    IMPORT: "Impor",
    PURCHASE: "Barang masuk",
    SALE: "Penjualan",
    ORDER_FULFILLED: "Pesanan selesai",
    ADJUSTMENT: "Opname / penyesuaian",
    RETURN: "Retur",
  };
  return labels[type] ?? type;
}

export default function StockPage() {
  const { success, error } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState<StockAction>("RECEIVE");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  const loadStock = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/admin/stock?page=${page}&pageSize=10`, { signal });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      const result = body as StockListResponse;
      setMovements(result.data);
      setProducts(result.products);
      setPagination(result.meta);
      setProductId((current) => current || result.products[0]?.id || "");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data stok.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStock(controller.signal);
    return () => controller.abort();
  }, [loadStock]);

  const selectedProduct = products.find((product) => product.id === productId);

  const openAction = (nextAction: StockAction) => {
    setAction(nextAction);
    setQty("");
    setNote("");
    setProductId((current) => current || products[0]?.id || "");
    setIsModalOpen(true);
  };

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "RECEIVE"
            ? {
                action,
                productId,
                qty: Number(qty),
                note: note.trim() || undefined,
              }
            : {
                action,
                productId,
                actualStock: Number(qty),
                note: note.trim(),
              }
        ),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(
        action === "RECEIVE" ? "Barang masuk berhasil dicatat" : "Stok opname berhasil dicatat",
        action === "RECEIVE"
          ? `${selectedProduct?.name ?? "Barang"}: +${qty} ${selectedProduct?.unit.name ?? ""}`
          : `Hasil opname ${selectedProduct?.name ?? "Barang"}: ${qty} ${selectedProduct?.unit.name ?? ""}`
      );
      setIsModalOpen(false);
      await loadStock();
    } catch (err) {
      error(
        "Gagal mencatat stok",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo<Column<StockMovement>[]>(
    () => [
      {
        header: "Waktu",
        cell: (movement) => (
          <span className="whitespace-nowrap">{formatDateWIB(movement.createdAt, true)}</span>
        ),
      },
      {
        header: "Barang",
        cell: (movement) => (
          <div>
            <p className="font-semibold text-slate-800">{movement.product.name}</p>
            <p className="text-xs text-slate-500 font-mono">{movement.product.sku}</p>
          </div>
        ),
      },
      {
        header: "Jenis",
        cell: (movement) => (
          <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
            {movementLabel(movement.type)}
          </span>
        ),
      },
      {
        header: "Perubahan",
        cell: (movement) => (
          <span className={movement.qtyChange >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>
            {movement.qtyChange > 0 ? "+" : ""}{movement.qtyChange} {movement.product.unit.name}
          </span>
        ),
      },
      {
        header: "Stok",
        cell: (movement) => (
          <span className="text-slate-700">
            {movement.stockBefore} <span className="text-slate-400">→</span> {movement.stockAfter}
          </span>
        ),
      },
      {
        header: "Catatan / Petugas",
        cell: (movement) => (
          <div className="max-w-56">
            <p className="truncate" title={movement.note ?? undefined}>{movement.note || movement.refType || "-"}</p>
            <p className="text-xs text-slate-500">{movement.user?.username ?? "Sistem"}</p>
          </div>
        ),
      },
    ],
    []
  );
  const lowStockProducts = products.filter((product) => product.stock <= product.minStock);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Stok</h1>
          <p className="text-sm text-slate-500 mt-1">Catat barang masuk, lakukan opname, dan pantau riwayat stok.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openAction("RECEIVE")}
            disabled={products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
          >
            <PackagePlus className="w-4 h-4" />
            Barang Masuk
          </button>
          <button
            type="button"
            onClick={() => openAction("OPNAME")}
            disabled={products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
          >
            <ClipboardList className="w-4 h-4" />
            Stok Opname
          </button>
        </div>
      </div>

      {products.length === 0 && !isLoading && !loadError ? (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <ArrowDownToLine className="w-5 h-5 shrink-0" />
          <p>Belum ada barang aktif. Tambahkan barang terlebih dahulu di menu Barang & Kategori.</p>
        </div>
      ) : null}

      {lowStockProducts.length > 0 ? (
        <section className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-sm font-semibold">Peringatan stok menipis ({lowStockProducts.length})</h2>
          </div>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.map((product) => (
              <li key={product.id} className="text-sm text-amber-900">
                <span className="font-medium">{product.name}</span>
                <span className="text-amber-700"> — stok {product.stock}, minimum {product.minStock} {product.unit.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loadError ? (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadStock()} className="font-semibold underline">
            Coba lagi
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={movements}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        emptyTitle="Belum ada riwayat stok"
        emptyDescription="Pergerakan stok akan muncul di sini setelah barang masuk atau opname dicatat."
        actionButton={
          <div className="text-xs text-slate-500">
            {pagination?.totalItems ?? 0} pergerakan stok
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSaving) setIsModalOpen(false);
        }}
        title={action === "RECEIVE" ? "Catat Barang Masuk" : "Catat Stok Opname"}
        description={
          action === "RECEIVE"
            ? "Jumlah akan ditambahkan ke stok barang."
            : "Masukkan jumlah fisik hasil penghitungan. Alasan opname wajib diisi."
        }
      >
        <form onSubmit={submitAction} className="space-y-4">
          <FormField label="Barang" name="productId" required>
            <select
              id="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} — {product.name}
                </option>
              ))}
            </select>
          </FormField>

          {selectedProduct ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
              <span className="text-slate-500">Stok saat ini: </span>
              <strong className="text-slate-800">{selectedProduct.stock} {selectedProduct.unit.name}</strong>
              {selectedProduct.reservedStock > 0 ? (
                <span className="ml-2 text-xs text-amber-700">
                  ({selectedProduct.reservedStock} tercadangkan)
                </span>
              ) : null}
            </div>
          ) : null}

          <FormField
            label={action === "RECEIVE" ? "Jumlah Barang Masuk" : "Jumlah Fisik Hasil Opname"}
            name="qty"
            required
            hint={action === "OPNAME" ? "Isi jumlah stok fisik setelah dihitung, bukan selisihnya." : undefined}
          >
            <Input
              id="qty"
              type="number"
              min={action === "RECEIVE" ? 1 : 0}
              step={1}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              required
            />
          </FormField>

          <FormField
            label={action === "OPNAME" ? "Alasan Opname" : "Alasan Barang Masuk"}
            name="note"
            required
          >
            <textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              required
              maxLength={500}
              rows={3}
              placeholder={
                action === "OPNAME"
                  ? "Contoh: Koreksi hasil penghitungan fisik"
                  : "Contoh: Restock dari pemasok"
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !productId}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}