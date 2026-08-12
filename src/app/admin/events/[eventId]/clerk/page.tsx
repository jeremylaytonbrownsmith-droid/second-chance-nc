import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClerkForm } from "./ClerkForm";

export default async function ClerkPage({
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
          DEMO MODE — no real awards, no real money
        </div>
      )}
      <h1 className="text-xl font-semibold">Live Auction Clerk — {event.name}</h1>
      <ClerkForm eventId={eventId} />
    </div>
  );
}
