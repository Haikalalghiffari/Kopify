
/**
 * KONTRAK TEKNIS ANTARMODUL: STOCK SERVICE
 * Tanggung Jawab P2
 */

import { Prisma, StockMovementType } from "@prisma/client";

// Transaction client untuk mendukung transaksi dari modul lain.
export type StockTransactionClient = Prisma.TransactionClient;

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
  /** Optional transaction supplied by caller */
  tx?: StockTransactionClient;
}

// ==========================================
// RELEASE STOCK
// ==========================================

export interface ReleaseStockParams {
  productId: string;
  qty: number;
  orderId: string;
  /** Optional transaction supplied by caller */
  tx?: StockTransactionClient;
}

// ==========================================
// COMMIT RESERVATION
// ==========================================

export interface CommitReservationParams {
  orderId: string;
  userId: string; // audit actor
  /** optional external transaction client */
  externalTx?: StockTransactionClient;
}


// ==========================================
// RECEIVE STOCKS (BARANG MASUK)
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
    params: AdjustStockParams,
    tx?: StockTransactionClient
  ): Promise<AdjustStockResult>;

  reserve(
    params: ReserveStockParams,
    tx?: StockTransactionClient
  ): Promise<void>;

  release(
    params: ReleaseStockParams,
    tx?: StockTransactionClient
  ): Promise<void>;

  commitReservation(
    params: CommitReservationParams,
    tx?: StockTransactionClient
  ): Promise<void>;

  receiveStock(
    params: ReceiveStockParams
  ): Promise<AdjustStockResult>;

  stockOpname(
    params: StockOpnameParams
  ): Promise<AdjustStockResult>;
}
