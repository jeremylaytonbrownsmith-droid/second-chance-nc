/**
 * Shared by src/proxy.ts (edge runtime) and the admin login server action
 * (node runtime), so it sticks to Web Crypto — the one hashing API both
 * runtimes support.
 */

export const ADMIN_SESSION_COOKIE = "admin_session";

export async function sessionTokenFor(username: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${username}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
