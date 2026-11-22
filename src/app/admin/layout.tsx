import type { ReactNode } from "react";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { AdminChrome } from "./AdminChrome";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminChrome demoMode={isDemoModeEnabled()}>{children}</AdminChrome>;
}
