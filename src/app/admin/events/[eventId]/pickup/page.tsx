import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listAwardsForPickup } from "@/lib/auction/pickup";
import { PickupList } from "./PickupList";

export const dynamic = "force-dynamic";

export default async function PickupPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const awards = await listAwardsForPickup(eventId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pickup — {event.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every won item, checked off as winners pick them up. Unclaimed items stay
          at the top.
        </p>
      </div>
      <PickupList
        eventId={eventId}
        awards={awards.map((a) => ({ ...a, pickedUpAt: a.pickedUpAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
