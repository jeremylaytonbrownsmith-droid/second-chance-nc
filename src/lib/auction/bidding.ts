import { prisma } from "@/lib/prisma";
import type { Bid, BidSource } from "@prisma/client";
import { assertCents } from "@/lib/money/deductible";
import { publishBidUpdate } from "@/lib/realtime/notify";

/**
 * Bid acceptance — Section 13. Accept the bid inside a transaction with a
 * row lock on the item so two people tapping bid at the same instant
 * can't both win. Publish (via src/lib/realtime/notify.ts) only after
 * this commits — never optimistically before the write lands.
 */

export class ItemNotOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotOpenError";
  }
}

export class BidTooLowError extends Error {
  constructor(
    message: string,
    public readonly minimumRequiredCents: number,
  ) {
    super(message);
    this.name = "BidTooLowError";
  }
}

export class BidRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BidRateLimitError";
  }
}

/** A stuck finger firing bids faster than this is rejected, not queued. */
export const BID_RATE_LIMIT_MS = 2_000;

export interface PlaceBidInput {
  itemId: string;
  registrationId: string;
  amountCents: number;
  source: BidSource;
}

export interface PlaceBidResult {
  bid: Bid;
  currentAmountCents: number;
  bidCount: number;
}

interface AuctionItemRow {
  id: string;
  status: string;
  startingBidCents: number | null;
  bidIncrementCents: number | null;
}

export async function placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
  assertCents(input.amountCents, "amountCents");

  return prisma.$transaction(async (tx) => {
    // Row lock: blocks any other placeBid on this item until this
    // transaction commits or rolls back.
    const rows = await tx.$queryRaw<AuctionItemRow[]>`
      SELECT id, status, "startingBidCents", "bidIncrementCents"
      FROM auction_items
      WHERE id = ${input.itemId}
      FOR UPDATE
    `;
    const item = rows[0];
    if (!item) {
      throw new ItemNotOpenError(`No such auction item: ${input.itemId}`);
    }
    if (item.status !== "OPEN") {
      throw new ItemNotOpenError(
        `Item ${input.itemId} is ${item.status}, not OPEN for bidding`,
      );
    }

    const recentBid = await tx.bid.findFirst({
      where: {
        registrationId: input.registrationId,
        voidedAt: null,
        placedAt: { gte: new Date(Date.now() - BID_RATE_LIMIT_MS) },
      },
      orderBy: { placedAt: "desc" },
    });
    if (recentBid) {
      throw new BidRateLimitError(
        `Registration ${input.registrationId} is bidding too fast — wait a moment and try again.`,
      );
    }

    const highBid = await tx.bid.findFirst({
      where: { itemId: input.itemId, voidedAt: null },
      orderBy: { amountCents: "desc" },
    });

    const minimumRequiredCents = highBid
      ? highBid.amountCents + (item.bidIncrementCents ?? 0)
      : (item.startingBidCents ?? 0);

    if (input.amountCents < minimumRequiredCents) {
      throw new BidTooLowError(
        `Minimum bid is ${minimumRequiredCents} cents`,
        minimumRequiredCents,
      );
    }

    const bid = await tx.bid.create({
      data: {
        itemId: input.itemId,
        registrationId: input.registrationId,
        amountCents: input.amountCents,
        source: input.source,
      },
    });

    const bidCount = await tx.bid.count({
      where: { itemId: input.itemId, voidedAt: null },
    });

    return { bid, currentAmountCents: input.amountCents, bidCount };
  }).then(async (result) => {
    // Publish only after the transaction above has committed.
    const registration = await prisma.registration.findUnique({
      where: { id: input.registrationId },
      select: { bidderNumber: true },
    });
    await publishBidUpdate({
      itemId: input.itemId,
      currentAmountCents: result.currentAmountCents,
      leadingBidderNumber: registration?.bidderNumber ?? null,
      bidCount: result.bidCount,
      serverTimestamp: new Date().toISOString(),
    });
    return result;
  });
}

export interface ItemBidState {
  itemId: string;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

/** Current state of an item's bidding — used for initial page load and for
 * clients reconciling after an SSE reconnect. */
export async function getItemBidState(itemId: string): Promise<ItemBidState> {
  const [item, highBid, bidCount] = await Promise.all([
    prisma.auctionItem.findUniqueOrThrow({ where: { id: itemId } }),
    prisma.bid.findFirst({
      where: { itemId, voidedAt: null },
      orderBy: { amountCents: "desc" },
      include: { registration: { select: { bidderNumber: true } } },
    }),
    prisma.bid.count({ where: { itemId, voidedAt: null } }),
  ]);

  return {
    itemId,
    currentAmountCents: highBid?.amountCents ?? item.startingBidCents ?? 0,
    leadingBidderNumber: highBid?.registration.bidderNumber ?? null,
    bidCount,
  };
}
