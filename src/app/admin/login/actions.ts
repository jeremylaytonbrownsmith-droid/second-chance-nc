"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, VOLUNTEER_USERNAME, sessionTokenFor } from "@/lib/admin-auth";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") || "/admin");

  const adminUsername = process.env.ADMIN_USERNAME || "secondchance";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const volunteerPassword = process.env.VOLUNTEER_PASSWORD ?? "";

  // Two possible credential pairs, admin checked first. Whichever one
  // matches determines the token (and therefore the role the proxy
  // resolves on every later request) — see src/lib/admin-auth.ts.
  let matchedUsername: string | null = null;
  let matchedPassword: string | null = null;
  if (adminPassword && username === adminUsername && password === adminPassword) {
    matchedUsername = adminUsername;
    matchedPassword = adminPassword;
  } else if (volunteerPassword && username === VOLUNTEER_USERNAME && password === volunteerPassword) {
    matchedUsername = VOLUNTEER_USERNAME;
    matchedPassword = volunteerPassword;
  }

  if (!matchedUsername || !matchedPassword) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await sessionTokenFor(matchedUsername, matchedPassword);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next || "/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
