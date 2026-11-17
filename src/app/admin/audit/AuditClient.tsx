"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ACTION_LABELS, ENTITY_LABELS } from "@/lib/audit";
import { ShieldCheck, Search, Filter, ChevronLeft, ChevronRight, Clock, User, Tag, Hash } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-700",
  LOGOUT: "bg-gray-100 text-gray-600",
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
  ACTIVATE: "bg-emerald-100 text-emerald-700",
  DEACTIVATE: "bg-orange-100 text-orange-700",
  RESET_PASSWORD: "bg-purple-100 text-purple-700",
  IMPORT: "bg-cyan-100 text-cyan-700",
  EXPORT: "bg-teal-100 text-teal-700",
  STOCK_ADJUSTMENT: "bg-yellow-100 text-yellow-700",
  STOCK_RESTOCK: "bg-lime-100 text-lime-700",
  ORDER_STATUS_CHANGE: "bg-indigo-100 text-indigo-700",
  SALE_CREATED: "bg-green-100 text-green-700",
  SALE_CANCELLED: "bg-red-100 text-red-700",
};

export default function AuditClient({
  logs,
  total,
  page,
  perPage,
  entities,
  actions,
  filters,
}: {
  logs: any[];
  total: number;
  page: number;
  perPage: number;
  entities: string[];
  actions: string[];
  filters: { entity: string; action: string; q: string };
}) {
  const router = useRouter();
  const totalPages = Math.ceil(total / perPage);

  const [q, setQ] = useState(filters.q);
  const [entity, setEntity] = useState(filters.entity);
  const [action, setAction] = useState(filters.action);
  const [, startTransition] = useTransition();

  const applyFilters = (overrides: Partial<typeof filters> & { page?: number }) => {
    const params = new URLSearchParams();
    const merged = { q, entity, action, page: 1, ...overrides };
    if (merged.q) params.set("q", merged.q);
    if (merged.entity) params.set("entity", merged.entity);
    if (merged.action) params.set("action", merged.action);
    if (merged.page > 1) params.set("page", String(merged.page));
    startTransition(() => router.push(`/admin/audit?${params.toString()}`));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0B3B2C] tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Log Aktivitas
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Riwayat seluruh aksi penting dalam sistem — {total.toLocaleString("id-ID")} entri.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters({ q })}
            placeholder="Cari pengguna, entitas, ID..."
            className="w-full text-xs p-2 rounded-xl border border-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B3B2C]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 shrink-0" />
          <select
            value={entity}
            onChange={(e) => { setEntity(e.target.value); applyFilters({ entity: e.target.value }); }}
            className="text-xs p-2 rounded-xl border border-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B3B2C]"
          >
            <option value="">Semua Entitas</option>
            {entities.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e] ?? e}</option>
            ))}
          </select>

          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); applyFilters({ action: e.target.value }); }}
            className="text-xs p-2 rounded-xl border border-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B3B2C]"
          >
            <option value="">Semua Aksi</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
            ))}
          </select>

          <button
            onClick={() => applyFilters({ q })}
            className="px-4 py-2 bg-[#0B3B2C] text-[#B6F53B] text-xs font-bold rounded-xl hover:bg-[#134B39] transition-colors"
          >
            Cari
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Waktu</span>
                </th>
                <th className="py-3 px-4">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> Pengguna</span>
                </th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">
                  <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> Entitas</span>
                </th>
                <th className="py-3 px-4">
                  <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> ID Referensi</span>
                </th>
                <th className="py-3 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    Tidak ada log aktivitas yang ditemukan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                      {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: localeId })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-gray-900">{log.user?.username ?? "—"}</span>
                      <span className="ml-1.5 text-[10px] text-gray-400 uppercase">[{log.user?.role}]</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-700">
                      {ENTITY_LABELS[log.entity] ?? log.entity}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-gray-500">
                      {log.entityId ? log.entityId.slice(0, 16) + (log.entityId.length > 16 ? "…" : "") : "—"}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      {log.detailJson ? (
                        <details className="cursor-pointer">
                          <summary className="text-[10px] text-emerald-700 font-bold hover:underline">Lihat detail</summary>
                          <pre className="text-[9px] text-gray-600 mt-1 bg-gray-50 rounded p-2 overflow-x-auto max-h-32">
                            {JSON.stringify(log.detailJson, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Menampilkan {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} dari {total.toLocaleString("id-ID")} log
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => applyFilters({ page: page - 1 })}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1.5 text-xs font-bold text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => applyFilters({ page: page + 1 })}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
