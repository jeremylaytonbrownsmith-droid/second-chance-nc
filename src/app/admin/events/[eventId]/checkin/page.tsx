import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckInForm } from "./CheckInForm";

export const dynamic = "force-dynamic";

/** Staff AND volunteers can check bidders in — see CLAUDE.md-equivalent
 * role notes in src/lib/admin/session.ts. No AdminOnlyNotice gate here,
 * unlike most of /admin/events/[eventId]/*. */
export default async function CheckInPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  return (
    <div className="space-y-4">
      {event.isDemo && (
        <div className="rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
          DEMO MODE — no real bidders, no real paddles
        </div>
      )}
      <h1 className="text-xl font-semibold">Check in — {event.name}</h1>
      <CheckInForm eventId={eventId} orgId={event.orgId} />
    </div>
  );
}
