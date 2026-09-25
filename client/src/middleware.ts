import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "../auth.config";

const { auth } = NextAuth(authConfig);

const ROLE_HOME: Record<string, string> = {
  admin: "/admin/dashboard",
  sales: "/sales/dashboard",
  ops: "/ops/dashboard",
};

export default auth((req) => {
  const { nextUrl } = req;
  const role = req.auth?.user?.role as string | undefined;
  const path = nextUrl.pathname;

  const isLogin = path === "/login";
  const isProtected =
    path.startsWith("/admin") || path.startsWith("/sales") || path.startsWith("/ops");

  // not signed in -> only /login allowed
  if (!role) {
    if (isProtected) return NextResponse.redirect(new URL("/login", nextUrl));
    return NextResponse.next();
  }

  // signed in and hitting /login or / -> send to their dashboard
  if (isLogin || path === "/") {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/login", nextUrl));
  }

  // signed in but hitting another role's area -> bounce to own home
  const area = path.split("/")[1];
  if (["admin", "sales", "ops"].includes(area) && area !== role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
