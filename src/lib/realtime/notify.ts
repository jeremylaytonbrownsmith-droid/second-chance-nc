import { prisma } from "@/lib/prisma";

/**
 * Section 13: real-time bid updates via Postgres NOTIFY, fanned out over
 * SSE (src/app/api/realtime/items/[itemId]/route.ts). Publish a compact
 * payload only — item id, current amount, leading bidder NUMBER, bid
 * count, server timestamp. Never the leading bidder's name to other
 * bidders watching the same item.
 */

export interface BidUpdatePayload {
  itemId: string;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
  serverTimestamp: string;
}

export function channelForItem(itemId: string): string {
  return `bid_item_${itemId}`;
}

/** Publish only after the bid transaction has committed — never optimistically. */
export async function publishBidUpdate(payload: BidUpdatePayload): Promise<void> {
  const channel = channelForItem(payload.itemId);
  await prisma.$executeRaw`SELECT pg_notify(${channel}, ${JSON.stringify(payload)})`;
}
