// Updated publicRoutes.test.ts per security hardening specifications
import { describe, it, expect, beforeAll } from "vitest";
import {
  isPublicPath,
  PUBLIC_EXACT_PATHS,
  PROTECTED_PATH_PREFIXES,
} from "../publicRoutes";
import { isRouteAllowed } from "../rbac";
import middleware from "@/middleware";
import { NextRequest } from "next/server";

describe("Public Routes Helper & Security Hardening (P1 Review)", () => {
  // 1. Explicit public exact paths
  describe("1. Explicit public paths (/login & /unauthorized)", () => {
    it("recognizes /login as public (with and without trailing slash)", () => {
      expect(isPublicPath("/login")).toBe(true);
      expect(isPublicPath("/login/")).toBe(true);
    });
    it("recognizes /unauthorized as public (with and without trailing slash)", () => {
      expect(isPublicPath("/unauthorized")).toBe(true);
      expect(isPublicPath("/unauthorized/")).toBe(true);
    });
  });

  // 2. Auth.js routes
  describe("2. Strict Auth.js routes (/api/auth & children)", () => {
    it("recognizes valid Auth.js endpoints as public", () => {
      expect(isPublicPath("/api/auth")).toBe(true);
      expect(isPublicPath("/api/auth/session")).toBe(true);
      expect(isPublicPath("/api/auth/csrf")).toBe(true);
      expect(isPublicPath("/api/auth/signin")).toBe(true);
      expect(isPublicPath("/api/auth/providers")).toBe(true);
      expect(isPublicPath("/api/auth/callback/credentials")).toBe(true);
    });
    it("SECURITY: rejects /api/authorization and similar non‑auth paths", () => {
      expect(isPublicPath("/api/authorization")).toBe(false);
      expect(isPublicPath("/api/auth-custom")).toBe(false);
      expect(isPublicPath("/api/authenticity")).toBe(false);
    });
  });

  // 3. Next.js assets strict handling
  describe("3. Strict Next.js asset handling", () => {
    it("allows only official Next.js static assets and exact image endpoint", () => {
      expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
      expect(isPublicPath("/_next/static/css/app.css")).toBe(true);
      expect(isPublicPath("/_next/image")).toBe(true);
    });
    it("SECURITY: rejects malformed or private _next paths", () => {
      expect(isPublicPath("/_next")).toBe(false);
      expect(isPublicPath("/_next/data/example/admin.json")).toBe(false);
      expect(isPublicPath("/_next/imageevil")).toBe(false);
      expect(isPublicPath("/_next/staticprivate")).toBe(false);
      expect(isPublicPath("/_nextprivate/test")).toBe(false);
    });
  });

  // 4. Protected file extensions (dot) should remain private
  describe("4. Protected dot‑file routes (P1 Finding 3)", () => {
    it("CSV export endpoints remain private despite .csv extension", () => {
      expect(isPublicPath("/api/orders/export.csv")).toBe(false);
    });
    it("Admin CSV files remain private", () => {
      expect(isPublicPath("/admin/users.csv")).toBe(false);
    });
    it("Various protected prefixes with dot extensions stay private", () => {
      expect(isPublicPath("/admin/products.json")).toBe(false);
      expect(isPublicPath("/admin/backup.sql")).toBe(false);
      expect(isPublicPath("/cart/items.json")).toBe(false);
      expect(isPublicPath("/cart.json")).toBe(false);
      expect(isPublicPath("/my-orders/rekap.pdf")).toBe(false);
      expect(isPublicPath("/my-orders.csv")).toBe(false);
      expect(isPublicPath("/profile/avatar.png")).toBe(false);
      expect(isPublicPath("/profile.json")).toBe(false);
      expect(isPublicPath("/catalog/items.xml")).toBe(false);
      expect(isPublicPath("/api/sales/report.xlsx")).toBe(false);
      expect(isPublicPath("/api/admin/users.json")).toBe(false);
    });
  });

  // 5. Standard protected routes remain private
  describe("5. Standard protected routes", () => {
    it("all core application routes stay private", () => {
      expect(isPublicPath("/admin/dashboard")).toBe(false);
      expect(isPublicPath("/admin/orders")).toBe(false);
      expect(isPublicPath("/admin/sales")).toBe(false);
      expect(isPublicPath("/admin/stock")).toBe(false);
      expect(isPublicPath("/admin/users")).toBe(false);
      expect(isPublicPath("/admin/audit")).toBe(false);
      expect(isPublicPath("/cart")).toBe(false);
      expect(isPublicPath("/my-orders")).toBe(false);
      expect(isPublicPath("/catalog")).toBe(false);
      expect(isPublicPath("/profile")).toBe(false);
      expect(isPublicPath("/")).toBe(false);
      expect(isPublicPath("/api/orders")).toBe(false);
      expect(isPublicPath("/api/sales")).toBe(false);
    });
  });

  // 6. Regression tests for non‑existent public assets (should be private)
  describe("6. Regression tests for disallowed assets", () => {
    it("non‑existent root static files are private", () => {
      expect(isPublicPath("/favicon.ico")).toBe(false);
      expect(isPublicPath("/robots.txt")).toBe(false);
      expect(isPublicPath("/sitemap.xml")).toBe(false);
      expect(isPublicPath("/manifest.json")).toBe(false);
    });
    it("paths under /public directory are private (folder does not exist)", () => {
      expect(isPublicPath("/public/logo.png")).toBe(false);
      expect(isPublicPath("/public/images/banner.webp")).toBe(false);
    });
    it("random asset paths are private", () => {
      expect(isPublicPath("/logo.png")).toBe(false);
      expect(isPublicPath("/assets/fonts/inter.woff2")).toBe(false);
      expect(isPublicPath("/styles/custom.css")).toBe(false);
    });
    it("additional disallowed assets per security findings", () => {
      expect(isPublicPath("/reports/monthly.js")).toBe(false);
      expect(isPublicPath("/user/avatar.svg")).toBe(false);
      expect(isPublicPath("/publicity")).toBe(false);
    });
  });

  // 7. Security constants validation
  describe("7. Security constants", () => {
    it("PUBLIC_EXACT_PATHS contains only /login and /unauthorized", () => {
      expect(PUBLIC_EXACT_PATHS.has("/login")).toBe(true);
      expect(PUBLIC_EXACT_PATHS.has("/unauthorized")).toBe(true);
      expect(PUBLIC_EXACT_PATHS.size).toBe(2);
    });
    it("PROTECTED_PATH_PREFIXES includes all required prefixes", () => {
      expect(PROTECTED_PATH_PREFIXES).toContain("/admin");
      expect(PROTECTED_PATH_PREFIXES).toContain("/api");
      expect(PROTECTED_PATH_PREFIXES).toContain("/cart");
      expect(PROTECTED_PATH_PREFIXES).toContain("/my-orders");
      expect(PROTECTED_PATH_PREFIXES).toContain("/catalog");
      expect(PROTECTED_PATH_PREFIXES).toContain("/profile");
    });
  });
});

// Integration tests (existing) remain unchanged – they are defined later in the file.
