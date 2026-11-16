import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "secondary"
  | "default";

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

const statusVariantMap: Record<string, { label: string; variant: BadgeVariant }> = {
  // OrderStatus
  DIAJUKAN: { label: "Diajukan", variant: "warning" },
  DIKONFIRMASI: { label: "Dikonfirmasi", variant: "info" },
  DISIAPKAN: { label: "Disiapkan", variant: "info" },
  SIAP_DIAMBIL: { label: "Siap Diambil", variant: "info" },
  SELESAI: { label: "Selesai", variant: "success" },
  DIBATALKAN: { label: "Dibatalkan", variant: "danger" },
  DITOLAK: { label: "Ditolak", variant: "danger" },

  // MemberStatus & General Status
  AKTIF: { label: "Aktif", variant: "success" },
  NONAKTIF: { label: "Nonaktif", variant: "secondary" },

  // PaymentStatus
  LUNAS: { label: "Lunas", variant: "success" },
  BELUM_LUNAS: { label: "Belum Lunas", variant: "warning" },

  // SaleStatus
  COMPLETED: { label: "Berhasil", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "danger" },

  // Stock Alert
  STOK_AMAN: { label: "Stok Aman", variant: "success" },
  STOK_MENIPIS: { label: "Stok Menipis", variant: "danger" },
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-800 border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  secondary: "bg-gray-100 text-gray-600 border-gray-200",
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const mapped = statusVariantMap[status.toUpperCase()];
  const finalVariant = variant || mapped?.variant || "default";
  const displayLabel = mapped?.label || status;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
        variantClasses[finalVariant],
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
