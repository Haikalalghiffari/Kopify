/**
 * Setelah impor selesai (SUCCESS atau PARTIAL), eksekusi ulang dengan file yang sama
 * hanya membuat log baru dan berisiko mengubah data lagi. Status FAILED berarti tidak
 * ada baris yang tersimpan, jadi pengguna boleh mencoba lagi.
 */
export function isImportExecutionLocked(
  result: { status: string } | null
): boolean {
  return result !== null && result.status !== "FAILED";
}
