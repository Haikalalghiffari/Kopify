import { describe, it, expect } from "vitest";
import { isRouteAllowed, hasRole } from "../rbac";

describe("RBAC Utility (P1)", () => {
  describe("isRouteAllowed", () => {
    it("Admin memiliki akses penuh ke rute admin", () => {
      expect(isRouteAllowed("/admin/dashboard", "ADMIN")).toBe(true);
      expect(isRouteAllowed("/admin/users", "ADMIN")).toBe(true);
      expect(isRouteAllowed("/admin/audit", "ADMIN")).toBe(true);
      expect(isRouteAllowed("/admin/import", "ADMIN")).toBe(true);
      expect(isRouteAllowed("/admin/reports", "ADMIN")).toBe(true);
    });

    it("Kasir hanya dapat mengakses rute yang diizinkan", () => {
      expect(isRouteAllowed("/admin/dashboard", "KASIR")).toBe(true);
      expect(isRouteAllowed("/admin/orders", "KASIR")).toBe(true);
      expect(isRouteAllowed("/admin/sales", "KASIR")).toBe(true);
      expect(isRouteAllowed("/admin/products", "KASIR")).toBe(true);

      // Kasir TIDAK boleh mengakses user management, audit log, atau import
      expect(isRouteAllowed("/admin/users", "KASIR")).toBe(false);
      expect(isRouteAllowed("/admin/audit", "KASIR")).toBe(false);
      expect(isRouteAllowed("/admin/import", "KASIR")).toBe(false);
    });

    it("Anggota hanya dapat mengakses portal anggota dan dilarang masuk panel admin", () => {
      expect(isRouteAllowed("/catalog", "ANGGOTA")).toBe(true);
      expect(isRouteAllowed("/cart", "ANGGOTA")).toBe(true);
      expect(isRouteAllowed("/my-orders", "ANGGOTA")).toBe(true);
      expect(isRouteAllowed("/profile", "ANGGOTA")).toBe(true);

      // Anggota TIDAK boleh mengakses panel admin
      expect(isRouteAllowed("/admin/dashboard", "ANGGOTA")).toBe(false);
      expect(isRouteAllowed("/admin/sales", "ANGGOTA")).toBe(false);
      expect(isRouteAllowed("/admin/stock", "ANGGOTA")).toBe(false);
    });

    it("User tanpa role (belum login) ditolak pada rute terproteksi", () => {
      expect(isRouteAllowed("/admin/dashboard", null)).toBe(false);
      expect(isRouteAllowed("/cart", null)).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("memvalidasi kecocokan role tunggal atau daftar role", () => {
      expect(hasRole("ADMIN", ["ADMIN", "KASIR"])).toBe(true);
      expect(hasRole("ANGGOTA", ["ADMIN", "KASIR"])).toBe(false);
      expect(hasRole(null, ["ADMIN"])).toBe(false);
    });
  });
});
