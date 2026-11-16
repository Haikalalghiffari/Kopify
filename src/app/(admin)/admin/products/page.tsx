"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FormField, Input } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/components/shared/Toast";
import { formatRupiah } from "@/lib/money";
import { PaginationMeta } from "@/lib/pagination";

interface LookupOption {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  unitId: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  reservedStock: number;
  minStock: number;
  isActive: boolean;
  category: LookupOption;
  unit: LookupOption;
}

interface ProductForm {
  sku: string;
  name: string;
  categoryId: string;
  unitId: string;
  costPrice: string;
  sellPrice: string;
  minStock: string;
}

const emptyForm: ProductForm = {
  sku: "",
  name: "",
  categoryId: "",
  unitId: "",
  costPrice: "0",
  sellPrice: "0",
  minStock: "5",
};

interface ProductListResponse {
  data: Product[];
  categories: LookupOption[];
  units: LookupOption[];
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

export default function ProductsPage() {
  const { success, error } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<LookupOption[]>([]);
  const [units, setUnits] = useState<LookupOption[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProducts = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError("");
      try {
        const [sortBy, order] = sortOrder.split("_");
        const query = new URLSearchParams({
          search,
          categoryId,
          sortBy: sortBy ?? "name",
          sortOrder: order ?? "asc",
          page: String(page),
          pageSize: "10",
        });
        const response = await fetch(`/api/admin/products?${query}`, { signal });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(body));

        const result = body as ProductListResponse;
        setProducts(result.data);
        setCategories(result.categories);
        setUnits(result.units);
        setPagination(result.meta);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Gagal memuat data barang.";
        setLoadError(message);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [categoryId, page, search, sortOrder]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadProducts(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadProducts]);

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "", unitId: units[0]?.id ?? "" });
    setIsFormOpen(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      categoryId: product.categoryId,
      unitId: product.unitId,
      costPrice: String(product.costPrice),
      sellPrice: String(product.sellPrice),
      minStock: String(product.minStock),
    });
    setIsFormOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingProduct ? { id: editingProduct.id } : {}),
          sku: form.sku.trim(),
          name: form.name.trim(),
          categoryId: form.categoryId,
          unitId: form.unitId,
          costPrice: Number(form.costPrice),
          sellPrice: Number(form.sellPrice),
          minStock: Number(form.minStock),
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(
        editingProduct ? "Barang diperbarui" : "Barang ditambahkan",
        `${form.name} berhasil disimpan.`
      );
      setIsFormOpen(false);
      await loadProducts();
    } catch (err) {
      error(
        "Gagal menyimpan barang",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingProduct.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success("Barang dinonaktifkan", `${deletingProduct.name} tidak lagi tampil sebagai barang aktif.`);
      setDeletingProduct(null);
      await loadProducts();
    } catch (err) {
      error(
        "Gagal menonaktifkan barang",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        header: "Barang",
        cell: (product) => (
          <div>
            <p className="font-semibold text-slate-800">{product.name}</p>
            <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
          </div>
        ),
      },
      {
        header: "Kategori / Satuan",
        cell: (product) => (
          <div>
            <p>{product.category.name}</p>
            <p className="text-xs text-slate-500">per {product.unit.name}</p>
          </div>
        ),
      },
      {
        header: "Harga Jual",
        cell: (product) => <span className="font-medium">{formatRupiah(product.sellPrice)}</span>,
      },
      {
        header: "Stok Tersedia",
        cell: (product) => {
          const available = product.stock - product.reservedStock;
          const isLow = available <= product.minStock;
          return (
            <div>
              <span className={isLow ? "font-semibold text-amber-700" : "font-medium text-slate-700"}>
                {available} {product.unit.name}
              </span>
              <p className="text-xs text-slate-500">Minimum {product.minStock}</p>
            </div>
          );
        },
      },
      {
        header: "Aksi",
        className: "text-right",
        cell: (product) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditForm(product)}
              className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
              aria-label={`Edit ${product.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingProduct(product)}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
              aria-label={`Nonaktifkan ${product.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Barang & Kategori</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data barang, harga, dan batas stok minimum.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={categories.length === 0 || units.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Tambah Barang
        </button>
      </div>

      {categories.length === 0 || units.length === 0 ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>Data kategori atau satuan belum tersedia. Tambahkan data tersebut sebelum membuat barang.</p>
        </div>
      ) : null}

      {loadError ? (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadProducts()} className="font-semibold underline">
            Coba lagi
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={products}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Cari SKU atau nama barang..."
        emptyTitle="Belum ada barang"
        emptyDescription="Tambahkan barang baru atau sesuaikan kata pencarian."
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter kategori barang"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select
              aria-label="Urutkan barang"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="name_asc">Nama A–Z</option>
              <option value="name_desc">Nama Z–A</option>
              <option value="sku_asc">SKU A–Z</option>
              <option value="sku_desc">SKU Z–A</option>
              <option value="sellPrice_asc">Harga jual terendah</option>
              <option value="sellPrice_desc">Harga jual tertinggi</option>
            </select>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Search className="w-4 h-4" />
              <span>{pagination?.totalItems ?? 0} barang</span>
            </div>
          </div>
        }
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          if (!isSaving) setIsFormOpen(false);
        }}
        title={editingProduct ? "Edit Barang" : "Tambah Barang"}
        description="Isi informasi barang. Perubahan stok dilakukan melalui menu Manajemen Stok."
        maxWidth="2xl"
      >
        <form onSubmit={submitForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="SKU" name="sku" required>
              <Input
                id="sku"
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                required
                maxLength={64}
                placeholder="Contoh: BRG-0007"
              />
            </FormField>
            <FormField label="Nama Barang" name="name" required>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                maxLength={255}
                placeholder="Nama barang"
              />
            </FormField>
            <FormField label="Kategori" name="categoryId" required>
              <select
                id="categoryId"
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="" disabled>Pilih kategori</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </FormField>
            <FormField label="Satuan" name="unitId" required>
              <select
                id="unitId"
                value={form.unitId}
                onChange={(event) => setForm({ ...form, unitId: event.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="" disabled>Pilih satuan</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </FormField>
            <FormField label="Harga Beli (Rp)" name="costPrice" required>
              <Input
                id="costPrice"
                type="number"
                min={0}
                step={1}
                value={form.costPrice}
                onChange={(event) => setForm({ ...form, costPrice: event.target.value })}
                required
              />
            </FormField>
            <FormField label="Harga Jual (Rp)" name="sellPrice" required>
              <Input
                id="sellPrice"
                type="number"
                min={0}
                step={1}
                value={form.sellPrice}
                onChange={(event) => setForm({ ...form, sellPrice: event.target.value })}
                required
              />
            </FormField>
            <FormField label="Stok Minimum" name="minStock" required>
              <Input
                id="minStock"
                type="number"
                min={0}
                step={1}
                value={form.minStock}
                onChange={(event) => setForm({ ...form, minStock: event.target.value })}
                required
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Barang"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingProduct)}
        onClose={() => {
          if (!isDeleting) setDeletingProduct(null);
        }}
        onConfirm={() => void deactivateProduct()}
        title="Nonaktifkan Barang"
        message={`Barang "${deletingProduct?.name ?? ""}" akan diarsipkan dan tidak tampil dalam daftar aktif. Data transaksi lama tetap tersimpan.`}
        confirmLabel="Nonaktifkan"
        isLoading={isDeleting}
      />
    </div>
  );
}