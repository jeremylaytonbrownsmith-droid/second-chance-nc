import { headers } from "next/headers";
import { STAFF_ROLE_HEADER, type StaffRole } from "@/lib/admin-auth";

export class UnauthenticatedError extends Error {
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenRoleError extends Error {
  constructor(message = "This action is restricted to admins.") {
    super(message);
    this.name = "ForbiddenRoleError";
  }
}

/**
 * Reads the role the proxy verified for this request (see src/proxy.ts).
 * Never trust a role from anywhere else — the header this reads is always
 * overwritten by the proxy before the request reaches here, so it can't be
 * spoofed by the client.
 */
export async function getStaffRole(): Promise<StaffRole | null> {
  const value = (await headers()).get(STAFF_ROLE_HEADER);
  return value === "admin" || value === "volunteer" ? value : null;
}

/** For actions/pages restricted to admins: edit FMV, payments, donors, and
 * event settings. Throws rather than silently no-opping — a volunteer
 * hitting this isn't a UI bug to swallow, it's an authorization failure. */
export async function requireAdminRole(): Promise<"admin"> {
  const role = await getStaffRole();
  if (!role) throw new UnauthenticatedError();
  if (role !== "admin") throw new ForbiddenRoleError();
  return role;
}

/** For actions/pages either role can use: check-in, entering bids,
 * recording pickup. Still throws if somehow reached with no verified
 * role at all (the proxy should already have blocked that). */
export async function requireStaffRole(): Promise<StaffRole> {
  const role = await getStaffRole();
  if (!role) throw new UnauthenticatedError();
  return role;
}
