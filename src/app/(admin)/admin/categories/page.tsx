"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, Pencil, RotateCcw, Tags } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FormField, Input } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/components/shared/Toast";
import { formatDateWIB } from "@/lib/date";
import { PaginationMeta } from "@/lib/pagination";

type MasterDataType = "CATEGORY" | "UNIT";
type StatusFilter = "ACTIVE" | "DELETED" | "ALL";

interface MasterDataRecord {
  id: string;
  name: string;
  deletedAt: string | null;
  createdAt: string;
  _count: { products: number };
}

interface MasterDataResponse {
  data: MasterDataRecord[];
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

export default function CategoriesPage() {
  const { success, error } = useToast();
  const [type, setType] = useState<MasterDataType>("CATEGORY");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<MasterDataRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [editingRecord, setEditingRecord] = useState<MasterDataRecord | null>(null);
  const [archivingRecord, setArchivingRecord] = useState<MasterDataRecord | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const title = type === "CATEGORY" ? "Kategori Barang" : "Satuan Barang";

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [sortBy, order] = sortOrder.split("_");
      const query = new URLSearchParams({
        type,
        status,
        search,
        sortBy: sortBy ?? "name",
        sortOrder: order ?? "asc",
        page: String(page),
        pageSize: "10",
      });
      const response = await fetch(`/api/admin/master-data?${query}`, { signal });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));
      const result = body as MasterDataResponse;
      setRecords(result.data);
      setPagination(result.meta);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [page, search, sortOrder, status, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadRecords(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadRecords]);

  const startCreate = () => {
    setEditingRecord(null);
    setName("");
    setIsModalOpen(true);
  };

  const startEdit = (record: MasterDataRecord) => {
    setEditingRecord(record);
    setName(record.name);
    setIsModalOpen(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/master-data", {
        method: editingRecord ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingRecord
            ? { action: "UPDATE", type, id: editingRecord.id, name: name.trim() }
            : { type, name: name.trim() }
        ),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(
        editingRecord ? `${title} diperbarui` : `${title} ditambahkan`,
        `${name.trim()} berhasil disimpan.`
      );
      setIsModalOpen(false);
      await loadRecords();
    } catch (err) {
      error(
        `Gagal menyimpan ${title.toLowerCase()}`,
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const archiveRecord = async () => {
    if (!archivingRecord) return;
    setIsArchiving(true);
    try {
      const response = await fetch("/api/admin/master-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id: archivingRecord.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(`${title} diarsipkan`, archivingRecord.name);
      setArchivingRecord(null);
      await loadRecords();
    } catch (err) {
      error(
        `Gagal mengarsipkan ${title.toLowerCase()}`,
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const restoreRecord = async (record: MasterDataRecord) => {
    try {
      const response = await fetch("/api/admin/master-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE", type, id: record.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(`${title} dipulihkan`, record.name);
      await loadRecords();
    } catch (err) {
      error(
        `Gagal memulihkan ${title.toLowerCase()}`,
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    }
  };

  const columns: Column<MasterDataRecord>[] = [
    {
      header: "Nama",
      accessorKey: "name",
      className: "font-medium text-slate-800",
    },
    {
      header: "Barang Aktif",
      cell: (record) => record._count.products,
    },
    {
      header: "Dibuat",
      cell: (record) => formatDateWIB(record.createdAt),
    },
    {
      header: "Status",
      cell: (record) => (
        <span
          className={
            record.deletedAt
              ? "inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium"
              : "inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium"
          }
        >
          {record.deletedAt ? "Diarsipkan" : "Aktif"}
        </span>
      ),
    },
    {
      header: "Aksi",
      className: "text-right",
      cell: (record) => (
        <div className="flex justify-end gap-2">
          {record.deletedAt ? (
            <button
              type="button"
              onClick={() => void restoreRecord(record)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Pulihkan
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startEdit(record)}
                className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                aria-label={`Edit ${record.name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setArchivingRecord(record)}
                disabled={record._count.products > 0}
                title={
                  record._count.products > 0
                    ? "Pindahkan barang aktif ke kategori/satuan lain terlebih dahulu."
                    : "Arsipkan"
                }
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={`Arsipkan ${record.name}`}
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
          <h1 className="text-2xl font-bold text-slate-900">Kategori & Satuan</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola pilihan kategori dan satuan untuk data barang.</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={status === "DELETED"}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          <Tags className="w-4 h-4" />
          Tambah {type === "CATEGORY" ? "Kategori" : "Satuan"}
        </button>
      </div>

      <div className="flex border-b border-slate-200">
        {(["CATEGORY", "UNIT"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setType(value);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              type === value
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {value === "CATEGORY" ? "Kategori" : "Satuan"}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadRecords()} className="font-semibold underline">
            Coba lagi
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={`Cari ${type === "CATEGORY" ? "kategori" : "satuan"}...`}
        emptyTitle={`Belum ada ${type === "CATEGORY" ? "kategori" : "satuan"}`}
        emptyDescription="Tambahkan data baru atau ubah filter pencarian."
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter status"
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
              aria-label="Urutkan data"
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
        title={`${editingRecord ? "Edit" : "Tambah"} ${type === "CATEGORY" ? "Kategori" : "Satuan"}`}
      >
        <form onSubmit={saveRecord} className="space-y-5">
          <FormField
            label={`Nama ${type === "CATEGORY" ? "Kategori" : "Satuan"}`}
            name="name"
            required
          >
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </FormField>
          <div className="flex justify-end gap-3">
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
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(archivingRecord)}
        onClose={() => {
          if (!isArchiving) setArchivingRecord(null);
        }}
        onConfirm={() => void archiveRecord()}
        title={`Arsipkan ${type === "CATEGORY" ? "Kategori" : "Satuan"}`}
        message={`"${archivingRecord?.name ?? ""}" akan diarsipkan. Data barang dan riwayat transaksi tidak dihapus.`}
        confirmLabel="Arsipkan"
        isLoading={isArchiving}
      />
    </div>
  );
}
