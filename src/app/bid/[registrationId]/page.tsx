import Image from "next/image";
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
    <div className="min-h-screen bg-gradient-to-b from-brand-lavender-tint to-white">
      <header className="border-b border-brand-lavender/40 bg-white/70 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Image
            src="/brand/second-chance-logo.png"
            alt="Second Chance Pet Adoptions"
            width={160}
            height={56}
            priority
            className="h-8 w-auto"
          />
          <span className="text-xs font-medium text-neutral-500">{registration.event.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {registration.event.isDemo && (
          <div className="mb-5 rounded-lg bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
            DEMO MODE — no real bids, no real money
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-brand-lavender/50 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
            Bidder #{registration.bidderNumber}
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-brand-purple-dark">{bidderName}</h1>
        </div>

        <BidBoard
          registrationId={registration.id}
          bidderNumber={registration.bidderNumber}
          items={itemsWithState.map(({ item, state }) => ({
            id: item.id,
            itemNumber: item.itemNumber,
            title: item.title,
            category: item.category,
            image: item.images[0] ?? null,
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
