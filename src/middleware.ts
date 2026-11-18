import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isRouteAllowed, UserRole } from "@/lib/rbac";
import { isPublicPath } from "@/lib/publicRoutes";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    // Lewatkan seluruh jalur publik sebelum pemeriksaan RBAC
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }

    const token = req.nextauth.token;
    const role = (token?.role as UserRole) || null;

    // Periksa otorisasi role untuk route yang diminta
    if (!isRouteAllowed(pathname, role)) {
      // Jika request API, kembalikan 403 Forbidden
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Akses Ditolak (403 Forbidden): Role Anda tidak memiliki izin." },
          { status: 403 }
        );
      }

      // Jika halaman web, arahkan ke halaman 403 atau dashboard sesuai role
      const redirectUrl = new URL("/unauthorized", req.url);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Rute publik bebas diakses tanpa login
        if (isPublicPath(pathname)) {
          return true;
        }

        // Semua rute lainnya membutuhkan token (harus login)
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
