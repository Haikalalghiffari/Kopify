/**
 * KONTRAK TEKNIS ANTARMODUL: STOCK SERVICE (Tanggung Jawab P2)
 * Disepakati pada Sprint 1 agar modul P3 (Impor Excel) dan P4 (Pesanan & Penjualan)
 * dapat bekerja tanpa terblokir sebelum rilis final P2 di Sprint 2.
 */

import { StockMovementType } from "@prisma/client";

export interface AdjustStockParams {
  productId: string;
  qtyChange: number; // Positif (masuk) atau Negatif (keluar)
  type: StockMovementType;
  refType?: string; // e.g. "PURCHASE", "ORDER", "ADJUSTMENT", "IMPORT"
  refId?: string;
  note?: string;
  userId?: string;
}

export interface AdjustStockResult {
  productId: string;
  qtyChange: number;
  stockBefore: number;
  stockAfter: number;
  movementId: string;
}

export interface ReserveStockParams {
  productId: string;
  qty: number;
  orderId: string;
}

export interface ReleaseStockParams {
  productId: string;
  qty: number;
  orderId: string;
}

export interface CommitReservationParams {
  orderId: string;
}

/**
 * Interface standar StockService yang harus diimplementasikan oleh P2.
 */
export interface IStockService {
  adjustStock(params: AdjustStockParams): Promise<AdjustStockResult>;
  reserve(params: ReserveStockParams): Promise<void>;
  release(params: ReleaseStockParams): Promise<void>;
  commitReservation(params: CommitReservationParams): Promise<void>;
}
