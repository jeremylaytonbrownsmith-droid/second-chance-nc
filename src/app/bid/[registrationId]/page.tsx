import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getItemBidState } from "@/lib/auction/bidding";
import { BidBoard } from "./BidBoard";

export default async function BidderPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { constituent: true, event: true },
  });
  if (!registration) notFound();

  const items = await prisma.auctionItem.findMany({
    where: {
      eventId: registration.eventId,
      itemType: "SILENT",
      voidedAt: null,
    },
    orderBy: { itemNumber: "asc" },
  });

  const itemsWithState = await Promise.all(
    items.map(async (item) => ({ item, state: await getItemBidState(item.id) })),
  );

  const bidderName = registration.constituent.isBusiness
    ? registration.constituent.orgName
    : `${registration.constituent.firstName ?? ""} ${registration.constituent.lastName ?? ""}`.trim();

  return (
    <div className="min-h-screen bg-brand-lavender-tint p-6">
      <div className="mx-auto max-w-2xl">
        {registration.event.isDemo && (
          <div className="mb-4 rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
            DEMO MODE — no real bids, no real money
          </div>
        )}
        <h1 className="text-xl font-semibold text-brand-purple-dark">
          Bidder #{registration.bidderNumber} — {bidderName}
        </h1>
        <p className="text-sm text-neutral-600">{registration.event.name}</p>

        <BidBoard
          registrationId={registration.id}
          bidderNumber={registration.bidderNumber}
          items={itemsWithState.map(({ item, state }) => ({
            id: item.id,
            itemNumber: item.itemNumber,
            title: item.title,
            fmvCents: item.fmvCents,
            bidIncrementCents: item.bidIncrementCents,
            status: item.status,
            currentAmountCents: state.currentAmountCents,
            leadingBidderNumber: state.leadingBidderNumber,
            bidCount: state.bidCount,
          }))}
        />
      </div>
    </div>
  );
}
