"use client";

import React from "react";
import { TableLoadingSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";
import { PaginationMeta } from "@/lib/pagination";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  actionButton?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  pagination,
  onPageChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Cari data...",
  actionButton,
  emptyTitle,
  emptyDescription,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Toolbar: Pencarian & Tombol Aksi */}
      {(onSearchChange || actionButton) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {onSearchChange ? (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchValue || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-colors"
              />
            </div>
          ) : (
            <div />
          )}

          {actionButton && <div>{actionButton}</div>}
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <TableLoadingSkeleton rows={5} />
        ) : data.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={emptyTitle || "Tidak Ada Data"}
              description={emptyDescription || "Belum ada rekaman yang cocok untuk kriteria ini."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  {columns.map((col, index) => (
                    <th
                      key={index}
                      scope="col"
                      className={cn("px-6 py-3.5", col.className)}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item, rowIndex) => (
                  <tr
                    key={item.id ? String(item.id) : rowIndex}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {columns.map((col, colIndex) => (
                      <td
                        key={colIndex}
                        className={cn("px-6 py-4 text-slate-700", col.className)}
                      >
                        {col.cell
                          ? col.cell(item)
                          : col.accessorKey
                          ? String(item[col.accessorKey] ?? "-")
                          : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginasi */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            <div>
              Menampilkan data halaman <span className="font-semibold text-slate-700">{pagination.page}</span> dari{" "}
              <span className="font-semibold text-slate-700">{pagination.totalPages}</span> (Total{" "}
              <span className="font-semibold text-slate-700">{pagination.totalItems}</span> entri)
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={!pagination.hasPrevPage}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
