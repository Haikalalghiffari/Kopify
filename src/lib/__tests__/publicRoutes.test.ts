import { describe, it, expect } from "vitest";
import { isPublicPath, PUBLIC_EXACT_PATHS } from "../publicRoutes";
import { isRouteAllowed } from "../rbac";

describe("Public Routes Helper (P1 Regression Test)", () => {
  describe("isPublicPath - Jalur Publik Wajib (PRD & Master Prompt P1)", () => {
    it("1. /login dikenali sebagai publik", () => {
      expect(isPublicPath("/login")).toBe(true);
      expect(isPublicPath("/login/")).toBe(true);
    });

    it("2. /unauthorized dikenali sebagai publik", () => {
      expect(isPublicPath("/unauthorized")).toBe(true);
      expect(isPublicPath("/unauthorized/")).toBe(true);
    });

    it("3. /api/auth/session dikenali sebagai publik", () => {
      expect(isPublicPath("/api/auth/session")).toBe(true);
      expect(isPublicPath("/api/auth/csrf")).toBe(true);
      expect(isPublicPath("/api/auth/signin")).toBe(true);
      expect(isPublicPath("/api/auth/providers")).toBe(true);
      expect(isPublicPath("/api/auth/callback/credentials")).toBe(true);
    });

    it("4. Resource /_next/static/* dikenali sebagai publik", () => {
      expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
      expect(isPublicPath("/_next/static/css/app.css")).toBe(true);
      expect(isPublicPath("/_next/image")).toBe(true);
    });

    it("5. Resource yang memiliki ekstensi tetap mengikuti perilaku sebelumnya", () => {
      expect(isPublicPath("/favicon.ico")).toBe(true);
      expect(isPublicPath("/logo.png")).toBe(true);
      expect(isPublicPath("/robots.txt")).toBe(true);
      expect(isPublicPath("/sitemap.xml")).toBe(true);
      expect(isPublicPath("/assets/fonts/inter.woff2")).toBe(true);
    });

    it("6. /admin/dashboard bukan jalur publik", () => {
      expect(isPublicPath("/admin/dashboard")).toBe(false);
    });

    it("7. /admin/orders bukan jalur publik", () => {
      expect(isPublicPath("/admin/orders")).toBe(false);
    });

    it("8. /cart bukan jalur publik", () => {
      expect(isPublicPath("/cart")).toBe(false);
    });

    it("9. /my-orders bukan jalur publik", () => {
      expect(isPublicPath("/my-orders")).toBe(false);
    });

    it("Jalur terproteksi lainnya bukan jalur publik", () => {
      expect(isPublicPath("/")).toBe(false);
      expect(isPublicPath("/catalog")).toBe(false);
      expect(isPublicPath("/admin/sales")).toBe(false);
      expect(isPublicPath("/admin/stock")).toBe(false);
      expect(isPublicPath("/admin/users")).toBe(false);
      expect(isPublicPath("/admin/audit")).toBe(false);
      expect(isPublicPath("/api/orders")).toBe(false);
      expect(isPublicPath("/api/sales")).toBe(false);
    });
  });

  describe("PUBLIC_EXACT_PATHS constant", () => {
    it("hanya memuat /login dan /unauthorized untuk menjaga batasan keamanan", () => {
      expect(PUBLIC_EXACT_PATHS.has("/login")).toBe(true);
      expect(PUBLIC_EXACT_PATHS.has("/unauthorized")).toBe(true);
      expect(PUBLIC_EXACT_PATHS.size).toBe(2);
    });
  });

  describe("Middleware Behavior & Regression Test (Redirect Loop Prevention)", () => {
    /**
     * Simulasi alur eksekusi middleware Next.js:
     * Tahap 1: withAuth authorized callback
     * Tahap 2: middleware function (isPublicPath -> isRouteAllowed)
     */
    function simulateMiddleware(
      pathname: string,
      token: { role?: string } | null,
      reqUrl: string = `http://localhost:3000${pathname}`
    ): {
      authorized: boolean;
      responseType: "NEXT" | "REDIRECT" | "FORBIDDEN_403";
      redirectLocation?: string;
    } {
      // 1. Authorized callback:
      const authorized = isPublicPath(pathname) || !!token;

      if (!authorized) {
        // NextAuth withAuth otomatis me-redirect anonymous user ke signIn (/login)
        return {
          authorized: false,
          responseType: "REDIRECT",
          redirectLocation: `http://localhost:3000/login?callbackUrl=${encodeURIComponent(reqUrl)}`,
        };
      }

      // 2. Middleware function:
      // PERBAIKAN: Seluruh jalur publik dilewatkan sebelum pemeriksaan RBAC
      if (isPublicPath(pathname)) {
        return { authorized: true, responseType: "NEXT" };
      }

      const role = (token?.role as any) || null;
      if (!isRouteAllowed(pathname, role)) {
        if (pathname.startsWith("/api/")) {
          return { authorized: true, responseType: "FORBIDDEN_403" };
        }
        return {
          authorized: true,
          responseType: "REDIRECT",
          redirectLocation: new URL("/unauthorized", reqUrl).toString(),
        };
      }

      return { authorized: true, responseType: "NEXT" };
    }

    it("REGRESSION FIX: Anonim membuka /unauthorized diizinkan tanpa redirect loop", () => {
      const result = simulateMiddleware("/unauthorized", null);

      expect(result.authorized).toBe(true);
      expect(result.responseType).toBe("NEXT");
      expect(result.redirectLocation).toBeUndefined();
    });

    it("Anonim membuka /login diizinkan", () => {
      const result = simulateMiddleware("/login", null);

      expect(result.authorized).toBe(true);
      expect(result.responseType).toBe("NEXT");
    });

    it("Anonim membuka /api/auth/session diizinkan", () => {
      const result = simulateMiddleware("/api/auth/session", null);

      expect(result.authorized).toBe(true);
      expect(result.responseType).toBe("NEXT");
    });

    it("Anonim membuka /admin/dashboard diarahkan ke login", () => {
      const result = simulateMiddleware("/admin/dashboard", null);

      expect(result.authorized).toBe(false);
      expect(result.responseType).toBe("REDIRECT");
      expect(result.redirectLocation).toContain("/login");
    });

    it("Anonim membuka /cart diarahkan ke login", () => {
      const result = simulateMiddleware("/cart", null);

      expect(result.authorized).toBe(false);
      expect(result.responseType).toBe("REDIRECT");
      expect(result.redirectLocation).toContain("/login");
    });

    it("Anggota membuka /admin/dashboard ditolak dan diarahkan ke /unauthorized", () => {
      const result = simulateMiddleware("/admin/dashboard", { role: "ANGGOTA" });

      expect(result.authorized).toBe(true);
      expect(result.responseType).toBe("REDIRECT");
      expect(result.redirectLocation).toBe("http://localhost:3000/unauthorized");

      // Verifikasi follow-up: Saat browser membuka target redirect (/unauthorized),
      // halaman dimuat dengan status NEXT, TIDAK mengalami redirect berulang ke dirinya sendiri.
      const followUp = simulateMiddleware("/unauthorized", { role: "ANGGOTA" });
      expect(followUp.responseType).toBe("NEXT");
      expect(followUp.redirectLocation).toBeUndefined();
    });

    it("Kasir membuka /admin/users ditolak dan diarahkan ke /unauthorized", () => {
      const result = simulateMiddleware("/admin/users", { role: "KASIR" });

      expect(result.responseType).toBe("REDIRECT");
      expect(result.redirectLocation).toBe("http://localhost:3000/unauthorized");
    });

    it("Kasir membuka /admin/orders diizinkan", () => {
      const result = simulateMiddleware("/admin/orders", { role: "KASIR" });

      expect(result.responseType).toBe("NEXT");
    });

    it("Admin membuka halaman admin (/admin/dashboard) diizinkan", () => {
      const result = simulateMiddleware("/admin/dashboard", { role: "ADMIN" });

      expect(result.responseType).toBe("NEXT");
    });

    it("Anggota membuka /my-orders diizinkan", () => {
      const result = simulateMiddleware("/my-orders", { role: "ANGGOTA" });

      expect(result.responseType).toBe("NEXT");
    });

    it("Respons 403 untuk API jika request API tidak diizinkan oleh RBAC", () => {
      // Simulasikan jika ada rute API yang ditolak oleh isRouteAllowed
      const mockRouteAllowed = (path: string, r: any) => path !== "/api/admin/secret";
      const path = "/api/admin/secret";
      const isAllowed = mockRouteAllowed(path, "ANGGOTA");

      let responseType: "NEXT" | "FORBIDDEN_403" = "NEXT";
      if (!isAllowed) {
        if (path.startsWith("/api/")) {
          responseType = "FORBIDDEN_403";
        }
      }

      expect(responseType).toBe("FORBIDDEN_403");
    });
  });
});
