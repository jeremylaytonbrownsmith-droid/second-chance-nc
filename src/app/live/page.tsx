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
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(121,71,168,0.4),transparent),radial-gradient(ellipse_60%_40%_at_90%_80%,rgba(219,189,243,0.12),transparent)]"
      />
      <header className="relative border-b border-white/10 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link href="/live" className="inline-flex items-center gap-3">
            <span className="inline-flex rounded-lg bg-white px-2.5 py-1.5 shadow-lg shadow-black/30">
              <Image
                src="/brand/second-chance-logo.png"
                alt="Second Chance Pet Adoptions"
                width={160}
                height={56}
                priority
                className="h-7 w-auto sm:h-8"
              />
            </span>
            <span className="text-sm font-medium text-white/60">Live</span>
          </Link>
          <Link
            href="/bid"
            className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-purple/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-purple-dark hover:shadow-xl"
          >
            Place a bid →
          </Link>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {event.isDemo && (
          <div className="mb-5 rounded-lg bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
            DEMO MODE — no real bids, no real money
          </div>
        )}
        <div className="mb-8 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{event.name}</h1>
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
