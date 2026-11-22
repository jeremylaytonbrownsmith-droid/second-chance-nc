import { getStaffRole } from "@/lib/admin/session";
import { EventSubNav } from "./EventSubNav";

/**
 * Shared tab nav for every /admin/events/[eventId]/* page — previously
 * only the catalog page (page.tsx) had a nav row, duplicated nowhere
 * else, so getting from e.g. Checkout to Pickup meant going back to the
 * catalog first. Each page still renders its own title and demo-mode
 * banner; this layout only adds the tab strip above them.
 */
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const isAdmin = (await getStaffRole()) === "admin";

  return (
    <div>
      <EventSubNav eventId={eventId} isAdmin={isAdmin} />
      {children}
    </div>
  );
}
