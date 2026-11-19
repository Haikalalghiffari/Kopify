import { describe, it, expect, beforeAll } from "vitest";
import {
  isPublicPath,
  PUBLIC_EXACT_PATHS,
  PUBLIC_ROOT_FILES,
  PROTECTED_PATH_PREFIXES,
} from "../publicRoutes";
import { isRouteAllowed } from "../rbac";
import middleware from "@/middleware";
import { NextRequest } from "next/server";

describe("Public Routes Helper & Security Hardening (P1 Review)", () => {
  describe("1. Jalur Publik Eksplisit (/login & /unauthorized)", () => {
    it("mengenali /login sebagai jalur publik (dengan dan tanpa trailing slash)", () => {
      expect(isPublicPath("/login")).toBe(true);
      expect(isPublicPath("/login/")).toBe(true);
    });

    it("mengenali /unauthorized sebagai jalur publik (dengan dan tanpa trailing slash)", () => {
      expect(isPublicPath("/unauthorized")).toBe(true);
      expect(isPublicPath("/unauthorized/")).toBe(true);
    });
  });

  describe("2. Batasan Ketat Auth.js (/api/auth & /api/auth/*)", () => {
    it("mengenali endpoint Auth.js yang valid sebagai jalur publik", () => {
      expect(isPublicPath("/api/auth")).toBe(true);
      expect(isPublicPath("/api/auth/session")).toBe(true);
      expect(isPublicPath("/api/auth/csrf")).toBe(true);
      expect(isPublicPath("/api/auth/signin")).toBe(true);
      expect(isPublicPath("/api/auth/providers")).toBe(true);
      expect(isPublicPath("/api/auth/callback/credentials")).toBe(true);
    });

    it("KEAMANAN (P1 Finding 1): menolak /api/authorization (TIDAK BOLEH dianggap publik)", () => {
      expect(isPublicPath("/api/authorization")).toBe(false);
      expect(isPublicPath("/api/auth-custom")).toBe(false);
      expect(isPublicPath("/api/authenticity")).toBe(false);
    });
  });

  describe("3. Batasan Ketat Next.js Assets (/_next & /_next/*)", () => {
    it("mengenali internal asset Next.js resmi sebagai publik", () => {
      expect(isPublicPath("/_next")).toBe(true);
      expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
      expect(isPublicPath("/_next/static/css/app.css")).toBe(true);
      expect(isPublicPath("/_next/image")).toBe(true);
    });

    it("KEAMANAN (P1 Finding 2): menolak /_nextprivate/test (TIDAK BOLEH dianggap publik)", () => {
      expect(isPublicPath("/_nextprivate/test")).toBe(false);
      expect(isPublicPath("/_next-custom")).toBe(false);
      expect(isPublicPath("/_nextprivate")).toBe(false);
    });
  });

  describe("4. Proteksi File dengan Titik (.) pada Rute Terproteksi (P1 Finding 3)", () => {
    it("KEAMANAN: /api/orders/export.csv TIDAK BOLEH menjadi publik meski memiliki ekstensi .csv", () => {
      expect(isPublicPath("/api/orders/export.csv")).toBe(false);
    });

    it("KEAMANAN: /admin/users.csv TIDAK BOLEH menjadi publik meski memiliki ekstensi .csv", () => {
      expect(isPublicPath("/admin/users.csv")).toBe(false);
    });

    it("KEAMANAN: rute terproteksi /admin/*, /api/*, /cart, /my-orders, /profile tidak menjadi publik karena titik", () => {
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

  describe("5. Rute Terproteksi Standar", () => {
    it("semua rute terproteksi aplikasi tetap bukan jalur publik", () => {
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

  describe("6. Static Assets Publik yang Sah", () => {
    it("mengenali file root standar publik", () => {
      expect(isPublicPath("/favicon.ico")).toBe(true);
      expect(isPublicPath("/robots.txt")).toBe(true);
      expect(isPublicPath("/sitemap.xml")).toBe(true);
      expect(isPublicPath("/manifest.json")).toBe(true);
    });

    it("mengenali file di direktori /public/*", () => {
      expect(isPublicPath("/public/logo.png")).toBe(true);
      expect(isPublicPath("/public/images/banner.webp")).toBe(true);
    });

    it("mengenali web assets statis umum di luar prefix terproteksi", () => {
      expect(isPublicPath("/logo.png")).toBe(true);
      expect(isPublicPath("/assets/fonts/inter.woff2")).toBe(true);
      expect(isPublicPath("/styles/custom.css")).toBe(true);
    });
  });

  describe("7. Konstanta Keamanan", () => {
    it("PUBLIC_EXACT_PATHS hanya memuat /login dan /unauthorized", () => {
      expect(PUBLIC_EXACT_PATHS.has("/login")).toBe(true);
      expect(PUBLIC_EXACT_PATHS.has("/unauthorized")).toBe(true);
      expect(PUBLIC_EXACT_PATHS.size).toBe(2);
    });

    it("PROTECTED_PATH_PREFIXES memuat seluruh prefix penting", () => {
      expect(PROTECTED_PATH_PREFIXES).toContain("/admin");
      expect(PROTECTED_PATH_PREFIXES).toContain("/api");
      expect(PROTECTED_PATH_PREFIXES).toContain("/cart");
      expect(PROTECTED_PATH_PREFIXES).toContain("/my-orders");
      expect(PROTECTED_PATH_PREFIXES).toContain("/catalog");
      expect(PROTECTED_PATH_PREFIXES).toContain("/profile");
    });
  });
});

describe("Actual Next.js Middleware Integration Test (Live withAuth Runner)", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test_secret_key_minimum_32_characters_long_12345";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /unauthorized diizinkan tanpa redirect loop", async () => {
    const req = new NextRequest("http://localhost:3000/unauthorized");
    const res = await (middleware as any)(req, {} as any);

    // Harus NextResponse.next() tanpa redirect location
    const location = res?.headers?.get("location");
    expect(location).toBeFalsy();
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /login diizinkan", async () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toBeFalsy();
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /api/auth/session diizinkan", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/session");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toBeFalsy();
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /admin/dashboard diarahkan ke login", async () => {
    const req = new NextRequest("http://localhost:3000/admin/dashboard");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toContain("/login");
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /cart diarahkan ke login", async () => {
    const req = new NextRequest("http://localhost:3000/cart");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toContain("/login");
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /my-orders diarahkan ke login", async () => {
    const req = new NextRequest("http://localhost:3000/my-orders");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toContain("/login");
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /admin/users.csv diarahkan ke login (TIDAK BOCOR)", async () => {
    const req = new NextRequest("http://localhost:3000/admin/users.csv");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toContain("/login");
  });

  it("ACTUAL MIDDLEWARE: Pengguna anonim membuka /api/orders/export.csv diarahkan ke login (TIDAK BOCOR)", async () => {
    const req = new NextRequest("http://localhost:3000/api/orders/export.csv");
    const res = await (middleware as any)(req, {} as any);

    const location = res?.headers?.get("location");
    expect(location).toContain("/login");
  });
});

describe("Middleware RBAC & Authorization Flow Simulation (Security Invariants)", () => {
  function simulateMiddlewarePipeline(
    pathname: string,
    token: { role?: string } | null,
    reqUrl: string = `http://localhost:3000${pathname}`
  ) {
    // 1. Authorized callback:
    const isAuthorized = isPublicPath(pathname) || !!token;
    if (!isAuthorized) {
      return {
        authorized: false,
        action: "REDIRECT_TO_SIGNIN",
        target: `/login?callbackUrl=${encodeURIComponent(reqUrl)}`,
      };
    }

    // 2. Middleware function:
    if (isPublicPath(pathname)) {
      return { authorized: true, action: "ALLOW_PUBLIC" };
    }

    const role = (token?.role as any) || null;
    if (!isRouteAllowed(pathname, role)) {
      if (pathname.startsWith("/api/")) {
        return { authorized: true, action: "FORBIDDEN_403" };
      }
      return {
        authorized: true,
        action: "REDIRECT_TO_UNAUTHORIZED",
        target: new URL("/unauthorized", reqUrl).toString(),
      };
    }

    return { authorized: true, action: "ALLOW_AUTHORIZED" };
  }

  it("Anonim pada /unauthorized: ALLOW_PUBLIC tanpa redirect loop", () => {
    const res = simulateMiddlewarePipeline("/unauthorized", null);
    expect(res.action).toBe("ALLOW_PUBLIC");
  });

  it("Anonim pada /login: ALLOW_PUBLIC", () => {
    const res = simulateMiddlewarePipeline("/login", null);
    expect(res.action).toBe("ALLOW_PUBLIC");
  });

  it("Anonim pada /api/auth/session: ALLOW_PUBLIC", () => {
    const res = simulateMiddlewarePipeline("/api/auth/session", null);
    expect(res.action).toBe("ALLOW_PUBLIC");
  });

  it("Anonim pada /api/authorization: REDIRECT_TO_SIGNIN (TIDAK BOCOR)", () => {
    const res = simulateMiddlewarePipeline("/api/authorization", null);
    expect(res.action).toBe("REDIRECT_TO_SIGNIN");
  });

  it("Anonim pada /_nextprivate/test: REDIRECT_TO_SIGNIN (TIDAK BOCOR)", () => {
    const res = simulateMiddlewarePipeline("/_nextprivate/test", null);
    expect(res.action).toBe("REDIRECT_TO_SIGNIN");
  });

  it("Anonim pada /api/orders/export.csv: REDIRECT_TO_SIGNIN (TIDAK BOCOR)", () => {
    const res = simulateMiddlewarePipeline("/api/orders/export.csv", null);
    expect(res.action).toBe("REDIRECT_TO_SIGNIN");
  });

  it("Anonim pada /admin/users.csv: REDIRECT_TO_SIGNIN (TIDAK BOCOR)", () => {
    const res = simulateMiddlewarePipeline("/admin/users.csv", null);
    expect(res.action).toBe("REDIRECT_TO_SIGNIN");
  });

  it("Anggota pada /admin/dashboard: REDIRECT_TO_UNAUTHORIZED", () => {
    const res = simulateMiddlewarePipeline("/admin/dashboard", { role: "ANGGOTA" });
    expect(res.action).toBe("REDIRECT_TO_UNAUTHORIZED");
  });

  it("Kasir pada /admin/users: REDIRECT_TO_UNAUTHORIZED", () => {
    const res = simulateMiddlewarePipeline("/admin/users", { role: "KASIR" });
    expect(res.action).toBe("REDIRECT_TO_UNAUTHORIZED");
  });

  it("Kasir pada /admin/orders: ALLOW_AUTHORIZED", () => {
    const res = simulateMiddlewarePipeline("/admin/orders", { role: "KASIR" });
    expect(res.action).toBe("ALLOW_AUTHORIZED");
  });

  it("Admin pada /admin/dashboard: ALLOW_AUTHORIZED", () => {
    const res = simulateMiddlewarePipeline("/admin/dashboard", { role: "ADMIN" });
    expect(res.action).toBe("ALLOW_AUTHORIZED");
  });

  it("Anggota pada /my-orders: ALLOW_AUTHORIZED", () => {
    const res = simulateMiddlewarePipeline("/my-orders", { role: "ANGGOTA" });
    expect(res.action).toBe("ALLOW_AUTHORIZED");
  });
});
