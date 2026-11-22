import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, STAFF_ROLE_HEADER, resolveStaffRole } from "@/lib/admin-auth";

/**
 * Stopgap password gate for the staff admin surface. There's no real auth
 * yet (Section 3 of the spec has that as email magic link for staff,
 * planned for Phase 2) — until then, this is the only thing standing
 * between a public URL and anyone being able to create/void records. Set
 * ADMIN_PASSWORD in the hosting environment to turn it on; if it's unset,
 * the app is left open (e.g. local dev where it hasn't been configured).
 *
 * Two roles share this one gate: admin (ADMIN_USERNAME/ADMIN_PASSWORD) and
 * volunteer (VOLUNTEER_USERNAME/VOLUNTEER_PASSWORD, optional — unset means
 * no volunteer login exists). Whichever one the session cookie matches is
 * written to the x-staff-role request header before the request is
 * forwarded, so every Server Component/Action/Route Handler downstream can
 * read the *verified* role via headers() — this header is always
 * overwritten here, so a client can't spoof it by sending its own.
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

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const role = await resolveStaffRole(cookie);

  if (role) {
    const headers = new Headers(request.headers);
    headers.set(STAFF_ROLE_HEADER, role);
    return NextResponse.next({ request: { headers } });
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
