import type { ReactNode } from "react";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { getStaffRole } from "@/lib/admin/session";
import { AdminChrome } from "./AdminChrome";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const role = await getStaffRole();
  return (
    <AdminChrome demoMode={isDemoModeEnabled()} role={role}>
      {children}
    </AdminChrome>
  );
}
