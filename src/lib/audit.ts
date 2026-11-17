/**
 * Audit Log Helper
 * Catat aksi penting ke tabel audit_logs secara non-blocking (best-effort).
 * Jika gagal, error di-log ke konsol tapi tidak melempar exception ke caller.
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ACTIVATE"
  | "DEACTIVATE"
  | "RESET_PASSWORD"
  | "IMPORT"
  | "EXPORT"
  | "STOCK_ADJUSTMENT"
  | "STOCK_RESTOCK"
  | "ORDER_STATUS_CHANGE"
  | "SALE_CREATED"
  | "SALE_CANCELLED";

export type AuditEntity =
  | "USER"
  | "MEMBER"
  | "PRODUCT"
  | "CATEGORY"
  | "ORDER"
  | "SALE"
  | "STOCK"
  | "IMPORT"
  | "AUTH"
  | "SYSTEM";

interface AuditParams {
  userId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  detail?: Record<string, any>;
}

/**
 * Catat log aktivitas — non-blocking, best-effort.
 */
export async function logActivity(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        detailJson: params.detail ? (params.detail as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (err) {
    // Best-effort: jangan gagalkan operasi utama hanya karena audit gagal
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}

/**
 * Label tampilan untuk action
 */
export const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  CREATE: "Buat Data",
  UPDATE: "Ubah Data",
  DELETE: "Hapus Data",
  ACTIVATE: "Aktifkan",
  DEACTIVATE: "Nonaktifkan",
  RESET_PASSWORD: "Reset Password",
  IMPORT: "Impor Data",
  EXPORT: "Ekspor Data",
  STOCK_ADJUSTMENT: "Penyesuaian Stok",
  STOCK_RESTOCK: "Barang Masuk",
  ORDER_STATUS_CHANGE: "Ubah Status Pesanan",
  SALE_CREATED: "Transaksi POS",
  SALE_CANCELLED: "Batalkan Transaksi",
};

/**
 * Label tampilan untuk entity
 */
export const ENTITY_LABELS: Record<string, string> = {
  USER: "Pengguna",
  MEMBER: "Anggota",
  PRODUCT: "Barang",
  CATEGORY: "Kategori",
  ORDER: "Pesanan",
  SALE: "Penjualan",
  STOCK: "Stok",
  IMPORT: "Impor",
  AUTH: "Autentikasi",
  SYSTEM: "Sistem",
};
