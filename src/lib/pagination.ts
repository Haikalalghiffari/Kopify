/**
 * Shared Pagination Utilities - Sistem Informasi Koperasi
 */

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Normalisasi parameter paginasi dari query string atau input fungsi.
 */
export function normalizePagination(params?: PaginationParams): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Number(params?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize) || 10));
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  return { page, pageSize, skip, take };
}

/**
 * Menghasilkan metadata paginasi lengkap untuk response API atau komponen tabel.
 */
export function getPaginationMeta(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return {
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

/**
 * Helper untuk membungkus data list dan metadata paginasi.
 */
export function createPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  return {
    data,
    meta: getPaginationMeta(totalItems, page, pageSize),
  };
}
