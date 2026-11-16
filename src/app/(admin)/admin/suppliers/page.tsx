"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, Pencil, RotateCcw, Truck } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FormField, Input } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/components/shared/Toast";
import { formatDateWIB } from "@/lib/date";
import { PaginationMeta } from "@/lib/pagination";

type StatusFilter = "ACTIVE" | "DELETED" | "ALL";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface SupplierForm {
  name: string;
  phone: string;
  address: string;
}

interface SupplierListResponse {
  data: Supplier[];
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

const emptyForm: SupplierForm = { name: "", phone: "", address: "" };

export default function SuppliersPage() {
  const { success, error } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [sortOrder, setSortOrder] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [archivingSupplier, setArchivingSupplier] = useState<Supplier | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const loadSuppliers = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [sortBy, order] = sortOrder.split("_");
      const query = new URLSearchParams({
        search,
        status,
        sortBy: sortBy ?? "name",
        sortOrder: order ?? "asc",
        page: String(page),
        pageSize: "10",
      });
      const response = await fetch(`/api/admin/suppliers?${query}`, { signal });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));
      const result = body as SupplierListResponse;
      setSuppliers(result.data);
      setPagination(result.meta);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data pemasok.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [page, search, sortOrder, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadSuppliers(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadSuppliers]);

  const openCreateForm = () => {
    setEditingSupplier(null);
    setForm({ ...emptyForm });
    setIsModalOpen(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
    });
    setIsModalOpen(true);
  };

  const saveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: editingSupplier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingSupplier
            ? {
                action: "UPDATE",
                id: editingSupplier.id,
                ...form,
                name: form.name.trim(),
                phone: form.phone.trim() || null,
                address: form.address.trim() || null,
              }
            : {
                ...form,
                name: form.name.trim(),
                phone: form.phone.trim() || null,
                address: form.address.trim() || null,
              }
        ),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(
        editingSupplier ? "Pemasok diperbarui" : "Pemasok ditambahkan",
        `${form.name} berhasil disimpan.`
      );
      setIsModalOpen(false);
      await loadSuppliers();
    } catch (err) {
      error(
        "Gagal menyimpan pemasok",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const archiveSupplier = async () => {
    if (!archivingSupplier) return;
    setIsArchiving(true);
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: archivingSupplier.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success("Pemasok diarsipkan", archivingSupplier.name);
      setArchivingSupplier(null);
      await loadSuppliers();
    } catch (err) {
      error(
        "Gagal mengarsipkan pemasok",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const restoreSupplier = async (supplier: Supplier) => {
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE", id: supplier.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success("Pemasok dipulihkan", supplier.name);
      await loadSuppliers();
    } catch (err) {
      error(
        "Gagal memulihkan pemasok",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    }
  };

  const columns: Column<Supplier>[] = [
    {
      header: "Nama Pemasok",
      cell: (supplier) => (
        <div>
          <p className="font-semibold text-slate-800">{supplier.name}</p>
          <p className="text-xs text-slate-500">Ditambahkan {formatDateWIB(supplier.createdAt)}</p>
        </div>
      ),
    },
    {
      header: "Kontak",
      cell: (supplier) => supplier.phone || "-",
    },
    {
      header: "Alamat",
      cell: (supplier) => (
        <span className="block max-w-sm truncate" title={supplier.address ?? undefined}>
          {supplier.address || "-"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (supplier) => (
        <span
          className={
            supplier.deletedAt
              ? "inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium"
              : "inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium"
          }
        >
          {supplier.deletedAt ? "Diarsipkan" : "Aktif"}
        </span>
      ),
    },
    {
      header: "Aksi",
      className: "text-right",
      cell: (supplier) => (
        <div className="flex justify-end gap-2">
          {supplier.deletedAt ? (
            <button
              type="button"
              onClick={() => void restoreSupplier(supplier)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Pulihkan
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openEditForm(supplier)}
                className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                aria-label={`Edit ${supplier.name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setArchivingSupplier(supplier)}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                aria-label={`Arsipkan ${supplier.name}`}
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Pemasok</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola nama, kontak, dan alamat pemasok koperasi.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={status === "DELETED"}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          <Truck className="w-4 h-4" />
          Tambah Pemasok
        </button>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadSuppliers()} className="font-semibold underline">
            Coba lagi
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Cari nama, telepon, atau alamat..."
        emptyTitle="Belum ada data pemasok"
        emptyDescription="Tambahkan pemasok atau ubah filter pencarian."
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter status pemasok"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="ACTIVE">Aktif</option>
              <option value="DELETED">Diarsipkan</option>
              <option value="ALL">Semua</option>
            </select>
            <select
              aria-label="Urutkan pemasok"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="name_asc">Nama A–Z</option>
              <option value="name_desc">Nama Z–A</option>
              <option value="createdAt_desc">Terbaru</option>
              <option value="createdAt_asc">Terlama</option>
            </select>
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSaving) setIsModalOpen(false);
        }}
        title={editingSupplier ? "Edit Pemasok" : "Tambah Pemasok"}
      >
        <form onSubmit={saveSupplier} className="space-y-4">
          <FormField label="Nama Pemasok" name="name" required>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={255}
              required
              autoFocus
            />
          </FormField>
          <FormField label="Nomor Telepon" name="phone" hint="Opsional">
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              maxLength={32}
            />
          </FormField>
          <FormField label="Alamat" name="address" hint="Opsional">
            <textarea
              id="address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              maxLength={1000}
              rows={3}
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
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Pemasok"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(archivingSupplier)}
        onClose={() => {
          if (!isArchiving) setArchivingSupplier(null);
        }}
        onConfirm={() => void archiveSupplier()}
        title="Arsipkan Pemasok"
        message={`"${archivingSupplier?.name ?? ""}" akan diarsipkan. Data pemasok tidak dihapus permanen.`}
        confirmLabel="Arsipkan"
        isLoading={isArchiving}
      />
    </div>
  );
}