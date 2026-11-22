import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getItemBidState } from "@/lib/auction/bidding";
import { closeExpiredItemsForEvent } from "@/lib/admin/auction-items";
import { getTotalRaisedCents } from "@/lib/checkout/checkout";
import { getOrCreateDemoEvent } from "@/lib/demo/seed";
import { ProjectorBoard } from "./ProjectorBoard";

export const dynamic = "force-dynamic";

/**
 * /live/projector — the screen you point at the wall, not the one you
 * hand someone. See src/app/live/page.tsx (the room-facing grid view)
 * and src/app/live/projector/ProjectorBoard.tsx for what makes this one
 * different: one item at a time, large type, auto-rotating, nothing to
 * click.
 */
export default async function ProjectorPage() {
  const event = await getOrCreateDemoEvent();
  if (!event) notFound();

  await closeExpiredItemsForEvent(event.id);
  const items = await prisma.auctionItem.findMany({
    where: { eventId: event.id, voidedAt: null, itemType: { in: ["SILENT", "LIVE"] } },
    orderBy: { itemNumber: "asc" },
  });

  const itemsWithState = await Promise.all(
    items.map(async (item) => ({ item, state: await getItemBidState(item.id) })),
  );

  const totalRaisedCents = event.goalCents ? await getTotalRaisedCents(event.id) : null;

  return (
    <ProjectorBoard
      eventName={event.name}
      totalRaisedCents={totalRaisedCents}
      goalCents={event.goalCents}
      items={itemsWithState.map(({ item, state }) => ({
        id: item.id,
        itemNumber: item.itemNumber,
        title: item.title,
        category: item.category,
        itemType: item.itemType,
        image: item.images[0] ?? null,
        fmvCents: item.fmvCents,
        status: item.status,
        closeAt: item.closeAt?.toISOString() ?? null,
        currentAmountCents: state.currentAmountCents,
        leadingBidderNumber: state.leadingBidderNumber,
        bidCount: state.bidCount,
      }))}
    />
  );
}
