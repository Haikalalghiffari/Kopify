
/**
 * KONTRAK TEKNIS ANTARMODUL: STOCK SERVICE
 * Tanggung Jawab P2
 */

import { StockMovementType } from "@prisma/client";

// ==========================================
// ADJUST STOCK
// ==========================================

export interface AdjustStockParams {
  productId: string;
  qtyChange: number;
  type: StockMovementType;
  refType?: string;
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

// ==========================================
// RESERVE STOCK
// ==========================================

export interface ReserveStockParams {
  productId: string;
  qty: number;
  orderId: string;
}

// ==========================================
// RELEASE STOCK
// ==========================================

export interface ReleaseStockParams {
  productId: string;
  qty: number;
  orderId: string;
}

// ==========================================
// COMMIT RESERVATION
// ==========================================

export interface CommitReservationParams {
  orderId: string;
}

// ==========================================
// RECEIVE STOCK (BARANG MASUK)
// ==========================================

export interface ReceiveStockParams {
  productId: string;
  qty: number;
  note: string;
  refId?: string;
  userId?: string;
}

// ==========================================
// STOCK OPNAME
// ==========================================

export interface StockOpnameParams {
  productId: string;
  actualStock: number;
  note: string;
  userId?: string;
}

// ==========================================
// STOCK SERVICE INTERFACE
// ==========================================

export interface IStockService {
  adjustStock(
    params: AdjustStockParams
  ): Promise<AdjustStockResult>;

  reserve(
    params: ReserveStockParams
  ): Promise<void>;

  release(
    params: ReleaseStockParams
  ): Promise<void>;

  commitReservation(
    params: CommitReservationParams
  ): Promise<void>;

  receiveStock(
    params: ReceiveStockParams
  ): Promise<AdjustStockResult>;

  stockOpname(
    params: StockOpnameParams
  ): Promise<AdjustStockResult>;
}
