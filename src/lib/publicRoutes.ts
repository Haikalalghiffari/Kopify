/**
 * Helper untuk mengidentifikasi jalur publik (public routes) pada Sistem Informasi Koperasi.
 * Jalur publik dapat diakses secara bebas tanpa memerlukan sesi login atau otorisasi RBAC.
 */

// 1. Rute aplikasi publik persis
export const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/unauthorized",
]);

// 2. File statis publik standar di root
export const PUBLIC_ROOT_FILES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
]);

// 3. Ekstensi file statis web umum (gambar, gaya, skrip, font)
const STATIC_WEB_EXTENSIONS = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff|woff2|ttf|eot|map)$/i;

// 4. Daftar prefix rute terproteksi yang TIDAK BOLEH menjadi publik
export const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/cart",
  "/my-orders",
  "/catalog",
  "/profile",
];

/**
 * Memeriksa apakah suatu pathname merupakan jalur publik.
 *
 * Aturan jalur publik aman:
 * 1. Jalur persis pada PUBLIC_EXACT_PATHS (/login, /unauthorized).
 * 2. Endpoint autentikasi Auth.js: HANYA /api/auth atau /api/auth/* (tidak termasuk /api/authorization).
 * 3. Asset internal Next.js: HANYA /_next atau /_next/* (tidak termasuk /_nextprivate/*).
 * 4. Direktori publik eksplisit: /public atau /public/*.
 * 5. File statis root yang terdaftar (/favicon.ico, /robots.txt, /sitemap.xml, /manifest.json).
 * 6. Proteksi ketat: Seluruh rute di bawah PROTECTED_PATH_PREFIXES (/admin, /api selain auth, /cart, dll.)
 *    TIDAK PERNAH dianggap sebagai jalur publik, sekalipun memiliki ekstensi atau titik (misal .csv, .json).
 * 7. Asset statis web lainnya hanya diizinkan jika berekstensi aman dan di luar rute terproteksi.
 */
export function isPublicPath(pathname: string): boolean {
  // Normalisasi trailing slash (misal /login/ -> /login)
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  // 1. Periksa rute aplikasi publik persis
  if (PUBLIC_EXACT_PATHS.has(normalized)) {
    return true;
  }

  // 2. Endpoint Auth.js: HANYA /api/auth atau /api/auth/*
  if (normalized === "/api/auth" || normalized.startsWith("/api/auth/")) {
    return true;
  }

  // 3. Asset internal Next.js: HANYA /_next atau /_next/*
  if (normalized === "/_next" || normalized.startsWith("/_next/")) {
    return true;
  }

  // 4. Direktori /public
  if (normalized === "/public" || normalized.startsWith("/public/")) {
    return true;
  }

  // 5. File root statis terdaftar
  if (PUBLIC_ROOT_FILES.has(normalized)) {
    return true;
  }

  // 6. PROTEKSI KETAT: Jika berada di bawah rute terproteksi, JANGAN PERNAH jadikan publik
  for (const prefix of PROTECTED_PATH_PREFIXES) {
    if (
      normalized === prefix ||
      normalized.startsWith(`${prefix}/`) ||
      normalized.startsWith(`${prefix}.`)
    ) {
      return false;
    }
  }

  // 7. Asset statis web aman lainnya di luar rute terproteksi (misal /logo.png, /assets/font.woff2)
  if (STATIC_WEB_EXTENSIONS.test(normalized)) {
    return true;
  }

  return false;
}
