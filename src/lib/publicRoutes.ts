/**
 * Helper untuk mengidentifikasi jalur publik (public routes) pada Sistem Informasi Koperasi.
 * Jalur publik dapat diakses secara bebas tanpa memerlukan sesi login atau otorisasi RBAC.
 */

export const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/unauthorized",
]);

/**
 * Memeriksa apakah suatu pathname merupakan jalur publik.
 *
 * Jalur publik meliputi:
 * 1. Path persis pada PUBLIC_EXACT_PATHS (/login, /unauthorized).
 * 2. Endpoint autentikasi Auth.js (/api/auth/*).
 * 3. Asset internal Next.js (/_next/*).
 * 4. File statis atau resource yang memiliki ekstensi file.
 */
export function isPublicPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return (
    PUBLIC_EXACT_PATHS.has(normalized) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  );
}
