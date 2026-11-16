import type { IStockService } from "@/services/contracts";

/**
 * Adapter ke stockService P2. Setelah P2 menambahkan `src/services/stockService.ts`,
 * hubungkan implementasi `IStockService` di sini tanpa mengubah kontrak.
 */
export async function resolveStockService(): Promise<IStockService | null> {
  return null;
}

export async function isProductImportExecutionAllowed(): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const service = await resolveStockService();
  if (!service) {
    return {
      allowed: false,
      reason:
        "Impor barang dengan stok awal menunggu stockService dari P2. Saat ini hanya impor anggota yang dapat dijalankan.",
    };
  }
  return { allowed: true };
}