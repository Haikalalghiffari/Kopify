"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

interface ImportHistoryItem {
  id: string;
  type: string;
  filename: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  status: string;
  createdAt: string;
  createdBy: string;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "SUCCESS") return "success";
  if (status === "PARTIAL") return "warning";
  if (status === "FAILED") return "danger";
  return "info";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SUCCESS: "Berhasil",
    PARTIAL: "Sebagian",
    FAILED: "Gagal",
    PENDING: "Menunggu",
  };
  return map[status] ?? status;
}

export function ImportHistoryPanel() {
  const [items, setItems] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import/history");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Gagal memuat riwayat.");
      }
      setItems(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onComplete = () => {
      void load();
    };
    window.addEventListener("kopify-import-complete", onComplete);
    return () => window.removeEventListener("kopify-import-complete", onComplete);
  }, [load]);

  return (
    <section className="mt-10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Riwayat impor</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 min-h-[44px]"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Muat ulang
        </button>
      </div>

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat riwayat...</div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Belum ada impor"
              description="Riwayat akan muncul setelah Anda menjalankan impor anggota."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">File</th>
                  <th className="px-4 py-3 text-left">Jenis</th>
                  <th className="px-4 py-3 text-left">Hasil</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{item.filename}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.type === "MEMBERS" ? "Anggota" : item.type}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs leading-relaxed">
                      Berhasil {item.successRows}, gagal {item.failedRows}, lewati{" "}
                      {item.skippedRows} / {item.totalRows} baris
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={statusLabel(item.status)}
                        variant={statusVariant(item.status)}
                        className="text-[10px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {item.failedRows > 0 ? (
                        <a
                          href={`/api/admin/import/history/${item.id}/errors`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 text-xs font-medium min-h-[44px]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Laporan error
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}