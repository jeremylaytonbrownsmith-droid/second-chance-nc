import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getItemBidState } from "@/lib/auction/bidding";
import { LiveBoard } from "./LiveBoard";

export default async function LiveAuctionBoardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [items, registrations] = await Promise.all([
    prisma.auctionItem.findMany({
      where: {
        eventId,
        voidedAt: null,
        itemType: { in: ["SILENT", "LIVE"] },
      },
      orderBy: { itemNumber: "asc" },
    }),
    prisma.registration.findMany({
      where: { eventId, voidedAt: null, status: "CHECKED_IN" },
      include: { constituent: true },
      orderBy: { bidderNumber: "asc" },
    }),
  ]);

  const itemsWithState = await Promise.all(
    items.map(async (item) => ({ item, state: await getItemBidState(item.id) })),
  );

  return (
    <div className="space-y-4">
      {event.isDemo && (
        <div className="rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
          DEMO MODE — the bidder buttons below simulate real phones bidding
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold">Live Auction Board — {event.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          What you&rsquo;d project on a screen at the venue — every item&rsquo;s current
          price, updating the instant a bid lands, from anyone&rsquo;s phone.
        </p>
      </div>

      <LiveBoard
        eventId={eventId}
        isDemo={event.isDemo}
        registrations={registrations.map((r) => ({
          id: r.id,
          bidderNumber: r.bidderNumber,
          name: r.constituent.isBusiness
            ? (r.constituent.orgName ?? "")
            : `${r.constituent.firstName ?? ""} ${r.constituent.lastName ?? ""}`.trim(),
        }))}
        items={itemsWithState.map(({ item, state }) => ({
          id: item.id,
          itemNumber: item.itemNumber,
          title: item.title,
          itemType: item.itemType,
          fmvCents: item.fmvCents,
          bidIncrementCents: item.bidIncrementCents,
          status: item.status,
          currentAmountCents: state.currentAmountCents,
          leadingBidderNumber: state.leadingBidderNumber,
          bidCount: state.bidCount,
        }))}
      />
    </div>
  );
}
