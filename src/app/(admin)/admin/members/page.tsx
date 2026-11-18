"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, Pencil, RotateCcw, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FormField, Input } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";
import { formatDateWIB } from "@/lib/date";
import { PaginationMeta } from "@/lib/pagination";

type MemberStatus = "AKTIF" | "NONAKTIF";
type StatusFilter = MemberStatus | "ARSIP" | "ALL";

interface Member {
  id: string;
  memberNo: string;
  name: string;
  nik: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  status: MemberStatus;
  deletedAt: string | null;
}

interface MemberForm {
  memberNo: string;
  name: string;
  nik: string;
  address: string;
  phone: string;
  email: string;
  joinedAt: string;
  status: MemberStatus;
}

interface MemberListResponse {
  data: Member[];
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

function todayWIB(): string {
  const now = new Date();
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wibNow.toISOString().slice(0, 10);
}

function emptyForm(): MemberForm {
  return {
    memberNo: "",
    name: "",
    nik: "",
    address: "",
    phone: "",
    email: "",
    joinedAt: todayWIB(),
    status: "AKTIF",
  };
}

export default function MembersPage() {
  const { success, error } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("AKTIF");
  const [sortOrder, setSortOrder] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [archivingMember, setArchivingMember] = useState<Member | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const loadMembers = useCallback(async (signal?: AbortSignal) => {
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
      const response = await fetch(`/api/admin/members?${query}`, { signal });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));
      const result = body as MemberListResponse;
      setMembers(result.data);
      setPagination(result.meta);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data anggota.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [page, search, sortOrder, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadMembers(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadMembers]);

  const openCreateForm = () => {
    setEditingMember(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditForm = (member: Member) => {
    setEditingMember(member);
    setForm({
      memberNo: member.memberNo,
      name: member.name,
      nik: member.nik ?? "",
      address: member.address ?? "",
      phone: member.phone ?? "",
      email: member.email ?? "",
      joinedAt: new Date(member.joinedAt).toISOString().slice(0, 10),
      status: member.status,
    });
    setIsModalOpen(true);
  };

  const saveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/members", {
        method: editingMember ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingMember ? { action: "UPDATE", id: editingMember.id } : {}),
          ...form,
          memberNo: form.memberNo.trim(),
          name: form.name.trim(),
          nik: form.nik.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase() || null,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success(
        editingMember ? "Anggota diperbarui" : "Anggota ditambahkan",
        `${form.name} berhasil disimpan.`
      );
      setIsModalOpen(false);
      await loadMembers();
    } catch (err) {
      error(
        "Gagal menyimpan anggota",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const archiveMember = async () => {
    if (!archivingMember) return;
    setIsArchiving(true);
    try {
      const response = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: archivingMember.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success("Anggota diarsipkan", archivingMember.name);
      setArchivingMember(null);
      await loadMembers();
    } catch (err) {
      error(
        "Gagal mengarsipkan anggota",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const restoreMember = async (member: Member) => {
    try {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE", id: member.id }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));

      success("Anggota dipulihkan", member.name);
      await loadMembers();
    } catch (err) {
      error(
        "Gagal memulihkan anggota",
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    }
  };

  const columns: Column<Member>[] = [
      {
        header: "Anggota",
        cell: (member) => (
          <div>
            <p className="font-semibold text-slate-800">{member.name}</p>
            <p className="text-xs text-slate-500 font-mono">{member.memberNo}</p>
          </div>
        ),
      },
      {
        header: "Kontak",
        cell: (member) => (
          <div>
            <p>{member.phone || "-"}</p>
            <p className="text-xs text-slate-500">{member.email || "-"}</p>
          </div>
        ),
      },
      {
        header: "Bergabung",
        cell: (member) => formatDateWIB(member.joinedAt),
      },
      {
        header: "Status",
        cell: (member) =>
          member.deletedAt ? (
            <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              Diarsipkan
            </span>
          ) : (
            <StatusBadge status={member.status} />
          ),
      },
      {
        header: "Aksi",
        className: "text-right",
        cell: (member) => (
          <div className="flex justify-end gap-2">
            {member.deletedAt ? (
              <button
                type="button"
                onClick={() => void restoreMember(member)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Pulihkan
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openEditForm(member)}
                  className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                  aria-label={`Edit ${member.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setArchivingMember(member)}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  aria-label={`Arsipkan ${member.name}`}
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
          <h1 className="text-2xl font-bold text-slate-900">Data Anggota</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola profil, status, dan informasi kontak anggota koperasi.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          disabled={status === "ARSIP"}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Anggota
        </button>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadMembers()} className="font-semibold underline">
            Coba lagi
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={members}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Cari nomor, nama, NIK, atau kontak..."
        emptyTitle="Belum ada data anggota"
        emptyDescription="Tambahkan anggota atau ubah filter pencarian."
        actionButton={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter status anggota"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
              <option value="ARSIP">Diarsipkan</option>
              <option value="ALL">Semua</option>
            </select>
            <select
              aria-label="Urutkan anggota"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="name_asc">Nama A–Z</option>
              <option value="name_desc">Nama Z–A</option>
              <option value="memberNo_asc">Nomor A–Z</option>
              <option value="joinedAt_desc">Bergabung terbaru</option>
              <option value="joinedAt_asc">Bergabung terlama</option>
            </select>
          </div>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSaving) setIsModalOpen(false);
        }}
        title={editingMember ? "Edit Anggota" : "Tambah Anggota"}
        description="Data identitas disimpan sesuai informasi yang diberikan anggota."
        maxWidth="2xl"
      >
        <form onSubmit={saveMember} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nomor Anggota" name="memberNo" required>
              <Input
                id="memberNo"
                value={form.memberNo}
                onChange={(event) => setForm({ ...form, memberNo: event.target.value })}
                maxLength={32}
                required
              />
            </FormField>
            <FormField label="Nama Lengkap" name="name" required>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={255}
                required
              />
            </FormField>
            <FormField label="NIK" name="nik" hint="Opsional">
              <Input
                id="nik"
                value={form.nik}
                onChange={(event) => setForm({ ...form, nik: event.target.value })}
                maxLength={32}
              />
            </FormField>
            <FormField label="Nomor HP" name="phone" hint="Opsional">
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                maxLength={32}
              />
            </FormField>
            <FormField label="Email" name="email" hint="Opsional">
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                maxLength={255}
              />
            </FormField>
            <FormField label="Tanggal Bergabung" name="joinedAt" required>
              <Input
                id="joinedAt"
                type="date"
                value={form.joinedAt}
                onChange={(event) => setForm({ ...form, joinedAt: event.target.value })}
                required
              />
            </FormField>
            <FormField label="Status Anggota" name="status" required>
              <select
                id="status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as MemberStatus })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </FormField>
            <FormField label="Alamat" name="address" hint="Opsional" className="sm:col-span-2">
              <textarea
                id="address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </FormField>
          </div>
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
              {isSaving ? "Menyimpan..." : "Simpan Anggota"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(archivingMember)}
        onClose={() => {
          if (!isArchiving) setArchivingMember(null);
        }}
        onConfirm={() => void archiveMember()}
        title="Arsipkan Anggota"
        message={`"${archivingMember?.name ?? ""}" akan diarsipkan. Akun anggota yang terhubung juga dinonaktifkan; data transaksi tetap tersimpan.`}
        confirmLabel="Arsipkan"
        isLoading={isArchiving}
      />
    </div>
  );
}