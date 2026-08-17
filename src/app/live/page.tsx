import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getItemBidState } from "@/lib/auction/bidding";
import { getOrCreateDemoEvent } from "@/lib/demo/seed";
import { LiveEventBoard } from "./LiveEventBoard";

/**
 * The screen for the room, not for staff — one link, no picking a bidder
 * identity first, no admin chrome. Every item's price live, on a phone or
 * projected on a wall. Complements the admin Live Auction Board (which is
 * the staff/operator view, behind the admin nav) and /bid (where a guest
 * actually places a bid).
 */
export default async function LiveEventPage() {
  const event = await getOrCreateDemoEvent();
  if (!event) notFound();

  const items = await prisma.auctionItem.findMany({
    where: { eventId: event.id, voidedAt: null, itemType: { in: ["SILENT", "LIVE"] } },
    orderBy: { itemNumber: "asc" },
  });

  const itemsWithState = await Promise.all(
    items.map(async (item) => ({ item, state: await getItemBidState(item.id) })),
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/live" className="inline-flex items-center gap-3">
            <span className="inline-flex rounded-lg bg-white px-2.5 py-1.5">
              <Image
                src="/brand/second-chance-logo.png"
                alt="Second Chance Pet Adoptions"
                width={160}
                height={56}
                priority
                className="h-6 w-auto sm:h-7"
              />
            </span>
            <span className="text-sm font-medium text-white/60">Live</span>
          </Link>
          <Link
            href="/bid"
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark"
          >
            Place a bid →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {event.isDemo && (
          <div className="mb-4 rounded-lg bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
            DEMO MODE — no real bids, no real money
          </div>
        )}
        <div className="mb-6 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <h1 className="text-xl font-semibold sm:text-2xl">{event.name}</h1>
        </div>

        <LiveEventBoard
          items={itemsWithState.map(({ item, state }) => ({
            id: item.id,
            itemNumber: item.itemNumber,
            title: item.title,
            category: item.category,
            itemType: item.itemType,
            image: item.images[0] ?? null,
            fmvCents: item.fmvCents,
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
