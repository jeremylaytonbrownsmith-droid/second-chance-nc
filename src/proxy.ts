import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Stopgap password gate for the whole app. There's no real auth yet
 * (Section 3 of the spec has that as email magic link for staff, planned
 * for Phase 2) — until then, this is the only thing standing between a
 * public URL and anyone being able to create/void records. Set
 * ADMIN_PASSWORD in the hosting environment to turn it on; if it's unset,
 * the app is left open (e.g. local dev where it hasn't been configured).
 */
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const username = process.env.ADMIN_USERNAME || "secondchance";
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, separatorIndex);
    const suppliedPass = decoded.slice(separatorIndex + 1);
    if (suppliedUser === username && suppliedPass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Second Chance Admin"' },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)",
  ],
};
