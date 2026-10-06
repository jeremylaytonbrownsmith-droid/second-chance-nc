import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, sessionTokenFor } from "@/lib/admin-auth";

/**
 * Stopgap password gate for the staff admin surface. There's no real auth
 * yet (Section 3 of the spec has that as email magic link for staff,
 * planned for Phase 2) — until then, this is the only thing standing
 * between a public URL and anyone being able to create/void records. Set
 * ADMIN_PASSWORD in the hosting environment to turn it on; if it's unset,
 * the app is left open (e.g. local dev where it hasn't been configured).
 *
 * Scoped to /admin and /api/admin only — guest-facing routes (/live, /bid,
 * /story) are never gated. Login is a branded page + session cookie
 * (src/app/admin/login) rather than a browser-native Basic Auth prompt,
 * which can't be styled and reads as unprofessional to staff logging in.
 */
export async function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const username = process.env.ADMIN_USERNAME || "secondchance";
  const expected = await sessionTokenFor(username, password);
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (cookie === expected) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
