/**
 * Role-Based Access Control (RBAC) - Sistem Informasi Koperasi
 */

export type UserRole = "ADMIN" | "KASIR" | "ANGGOTA";

export interface RoutePermission {
  pathPrefix: string;
  allowedRoles: UserRole[];
}

/**
 * Pemetaan izin akses rute berdasarkan role
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Halaman khusus Admin saja
  {
    pathPrefix: "/admin/users",
    allowedRoles: ["ADMIN"],
  },
  {
    pathPrefix: "/admin/audit",
    allowedRoles: ["ADMIN"],
  },
  {
    pathPrefix: "/admin/import",
    allowedRoles: ["ADMIN"],
  },
  // Halaman Admin & Kasir
  {
    pathPrefix: "/admin/dashboard",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin/members",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin/products",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin/stock",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin/orders",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin/sales",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin/reports",
    allowedRoles: ["ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/admin",
    allowedRoles: ["ADMIN", "KASIR"],
  },

  // Halaman Anggota
  {
    pathPrefix: "/catalog",
    allowedRoles: ["ANGGOTA", "ADMIN", "KASIR"],
  },
  {
    pathPrefix: "/cart",
    allowedRoles: ["ANGGOTA"],
  },
  {
    pathPrefix: "/my-orders",
    allowedRoles: ["ANGGOTA"],
  },
  {
    pathPrefix: "/profile",
    allowedRoles: ["ANGGOTA", "ADMIN", "KASIR"],
  },
];

/**
 * Memeriksa apakah suatu role diizinkan mengakses path tertentu
 */
export function isRouteAllowed(pathname: string, role?: UserRole | null): boolean {
  if (!role) {
    return false;
  }

  // Admin memiliki akses global kecuali rute khusus anggota yang membutuhkan memberId
  if (role === "ADMIN" && !pathname.startsWith("/cart") && !pathname.startsWith("/my-orders")) {
    return true;
  }

  // Cari permission yang paling spesifik (pathPrefix terpanjang)
  const matchingRule = ROUTE_PERMISSIONS.filter((p) =>
    pathname.startsWith(p.pathPrefix)
  ).sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)[0];

  if (!matchingRule) {
    // Rute publik atau tidak terdaftar secara eksplisit
    return true;
  }

  return matchingRule.allowedRoles.includes(role);
}

/**
 * Memeriksa apakah user memiliki salah satu dari role yang dibutuhkan
 */
export function hasRole(currentRole: UserRole | undefined | null, requiredRoles: UserRole[]): boolean {
  if (!currentRole) return false;
  return requiredRoles.includes(currentRole);
}
