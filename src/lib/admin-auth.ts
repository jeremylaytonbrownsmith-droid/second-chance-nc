/**
 * Shared by src/proxy.ts (edge runtime) and the admin login server action
 * (node runtime), so it sticks to Web Crypto — the one hashing API both
 * runtimes support.
 */

export const ADMIN_SESSION_COOKIE = "admin_session";

/** Set by the proxy on every request after verifying the session cookie,
 * so Server Components/Actions/Route Handlers can read the *verified*
 * role via headers() — never trust a role sent by the client directly,
 * only this header, which the proxy always overwrites before forwarding
 * the request. */
export const STAFF_ROLE_HEADER = "x-staff-role";

export type StaffRole = "admin" | "volunteer";

/** Second, lower-privilege shared login. Same "stopgap until real staff
 * auth ships" model as ADMIN_USERNAME/ADMIN_PASSWORD — one password for
 * every volunteer, not per-person accounts. Volunteers can check in
 * bidders, enter live-auction hammer prices, and (once built) record item
 * pickup; only the admin login can touch FMV, payments, donors, and event
 * settings. See CLAUDE.md-equivalent note in src/lib/admin/session.ts. */
export const VOLUNTEER_USERNAME = process.env.VOLUNTEER_USERNAME || "volunteer";

export async function sessionTokenFor(username: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${username}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Recomputes both roles' expected session tokens from env vars and
 * returns whichever one `cookie` matches, or null. The volunteer pair is
 * optional — if VOLUNTEER_PASSWORD isn't set, nothing can ever match it,
 * same "unset = that credential doesn't exist" convention as ADMIN_PASSWORD. */
export async function resolveStaffRole(cookie: string | undefined): Promise<StaffRole | null> {
  if (!cookie) return null;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const adminUsername = process.env.ADMIN_USERNAME || "secondchance";
    if (cookie === (await sessionTokenFor(adminUsername, adminPassword))) {
      return "admin";
    }
  }

  const volunteerPassword = process.env.VOLUNTEER_PASSWORD;
  if (volunteerPassword) {
    if (cookie === (await sessionTokenFor(VOLUNTEER_USERNAME, volunteerPassword))) {
      return "volunteer";
    }
  }

  return null;
}
