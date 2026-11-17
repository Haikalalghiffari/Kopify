import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const session = (req as any).auth;
  const isLoggedIn = !!session;
  const role = session?.user?.role;

  const isAuthPage = nextUrl.pathname === "/login";
  const isAdminPage = nextUrl.pathname.startsWith("/admin");
  const isMemberPage = nextUrl.pathname.startsWith("/member");
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    if (role === "ANGGOTA") {
      return NextResponse.redirect(new URL("/member/catalog", nextUrl));
    }
    return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
  }

  if (isAdminPage && role === "ANGGOTA") {
    return NextResponse.redirect(new URL("/member/catalog", nextUrl));
  }

  if (isMemberPage && (role === "ADMIN" || role === "KASIR")) {
    return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
