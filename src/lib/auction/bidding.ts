import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import { Prisma, type Award, type Bid, type BidSource } from "@prisma/client";
import { assertCents } from "@/lib/money/deductible";
import { publishBidUpdate } from "@/lib/realtime/notify";
import { notifyOutbid } from "@/lib/sms/outbid-notification";

/**
 * Bid acceptance — Section 13. Accept the bid inside a transaction with a
 * row lock on the item so two people tapping bid at the same instant
 * can't both win. Publish (via src/lib/realtime/notify.ts) only after
 * this commits — never optimistically before the write lands.
 *
 * Proxy (max) bidding: a bid with isMaxBid=true records the bidder's
 * secret ceiling as its amountCents, but what's displayed/published as
 * "the current price" is resolved separately (resolveBidPositions below)
 * — just enough to stay ahead of the next-highest standing bid, never
 * the bidder's full ceiling unless someone else's ceiling forces it that
 * high. A plain (non-max) bid has no such gap: its own amount is always
 * exactly what displays when it's leading, same as before proxy bidding
 * existed, which is what keeps every existing plain-bid test passing
 * unchanged.
 */

export class ItemNotOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotOpenError";
  }
}

// Thrown only when an item's closeAt has passed but the sweep hasn't
// flipped its status column yet. Carries itemId so the caller can close
// the item out *after* the enclosing transaction has rolled back — doing
// that write through `tx` itself would both get rolled back by the throw
// and deadlock against the very row lock this function just took.
class ItemExpiredError extends ItemNotOpenError {
  constructor(public readonly itemId: string, message: string) {
    super(message);
    this.name = "ItemExpiredError";
  }
}

async function closeExpiredItem(error: unknown): Promise<void> {
  if (error instanceof ItemExpiredError) {
    await prisma.$transaction((tx) => closeItemAndAward(tx, error.itemId));
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

export class BuyNowUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuyNowUnavailableError";
  }
}

/** A stuck finger firing bids faster than this is rejected, not queued. */
export const BID_RATE_LIMIT_MS = 2_000;

export interface PlaceBidInput {
  itemId: string;
  registrationId: string;
  amountCents: number;
  source: BidSource;
  /** True for a proxy/max bid — amountCents is the bidder's ceiling, not
   * necessarily what ends up displayed. Defaults to false (a plain bid,
   * today's pre-proxy-bidding behavior, preserved exactly). */
  isMaxBid?: boolean;
  /** Event night, item 15 (offline resilience): a client-generated id,
   * resent unchanged on every retry of the same bid attempt. If a bid
   * with this id already exists, this call is a replay of one that
   * already landed (the request succeeded but the response never made
   * it back before the connection dropped) — return that bid's current
   * state instead of inserting a second one or re-running the rate
   * limit / minimum-bid checks a retry would otherwise fail. */
  clientRequestId?: string;
}

export interface PlaceBidResult {
  bid: Bid;
  currentAmountCents: number;
  bidCount: number;
}

interface BidPosition {
  registrationId: string;
  amountCents: number;
  isMaxBid: boolean;
  placedAt: Date;
}

export interface ResolvedBidState {
  currentAmountCents: number;
  leaderRegistrationId: string | null;
}

/** Reduces a list of bids to each registration's single, latest standing
 * position — an earlier bid from someone who has since placed a new one
 * no longer counts for anything. */
function latestPositionPerRegistration(bids: BidPosition[]): BidPosition[] {
  const latest = new Map<string, BidPosition>();
  for (const bid of bids) {
    const current = latest.get(bid.registrationId);
    if (!current || bid.placedAt > current.placedAt) {
      latest.set(bid.registrationId, bid);
    }
  }
  return Array.from(latest.values());
}

/**
 * Pure resolution: given every registration's current standing position
 * on an item, who's leading and what price actually displays. Plain bids
 * display at face value, always. A max bid displays at just enough to
 * clear the next-highest standing position by one increment (or the
 * starting bid, if it's uncontested) — never more than its own ceiling.
 * Ties (equal ceiling) go to whoever got there first.
 */
export function resolveBidPositions(
  allPositions: BidPosition[],
  startingBidCents: number,
  incrementCents: number,
): ResolvedBidState {
  const positions = latestPositionPerRegistration(allPositions);
  if (positions.length === 0) {
    return { currentAmountCents: startingBidCents, leaderRegistrationId: null };
  }

  const sorted = [...positions].sort((a, b) => {
    if (b.amountCents !== a.amountCents) return b.amountCents - a.amountCents;
    return a.placedAt.getTime() - b.placedAt.getTime(); // earlier ceiling wins a tie
  });
  const leader = sorted[0];
  const runnerUp = sorted[1] as BidPosition | undefined;

  if (!leader.isMaxBid) {
    // A plain bid's own stated amount is what displays, full stop —
    // exactly today's behavior when no one has placed a max bid.
    return { currentAmountCents: leader.amountCents, leaderRegistrationId: leader.registrationId };
  }

  const pressureFloor = runnerUp ? runnerUp.amountCents + incrementCents : startingBidCents;
  const currentAmountCents = Math.min(leader.amountCents, Math.max(pressureFloor, startingBidCents));
  return { currentAmountCents, leaderRegistrationId: leader.registrationId };
}

interface AuctionItemRow {
  id: string;
  status: string;
  startingBidCents: number | null;
  bidIncrementCents: number | null;
  buyNowCents: number | null;
  closeAt: Date | null;
}

async function lockItemRow(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itemId: string,
): Promise<AuctionItemRow> {
  const rows = await tx.$queryRaw<AuctionItemRow[]>`
    SELECT id, status, "startingBidCents", "bidIncrementCents", "buyNowCents", "closeAt"
    FROM auction_items
    WHERE id = ${itemId}
    FOR UPDATE
  `;
  const item = rows[0];
  if (!item) {
    throw new ItemNotOpenError(`No such auction item: ${itemId}`);
  }
  if (item.status !== "OPEN") {
    throw new ItemNotOpenError(`Item ${itemId} is ${item.status}, not OPEN for bidding`);
  }
  // Staggered close (item 11): the lazy sweep (closeExpiredItemsForEvent)
  // normally flips this to CLOSED before anyone gets here, but a bid can
  // slip in between sweeps — closeAt itself is the source of truth, not
  // just the status column. The actual status write happens after this
  // transaction unwinds (see closeExpiredItem) — see ItemExpiredError.
  if (item.closeAt && item.closeAt <= new Date()) {
    throw new ItemExpiredError(itemId, `Item ${itemId} closed at ${item.closeAt.toISOString()}`);
  }
  return item;
}

async function currentPositions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itemId: string,
): Promise<BidPosition[]> {
  const bids = await tx.bid.findMany({
    where: { itemId, voidedAt: null },
    select: { registrationId: true, amountCents: true, isMaxBid: true, placedAt: true },
  });
  return latestPositionPerRegistration(bids);
}

export interface CloseItemAndAwardResult {
  status: "AWARDED" | "UNSOLD";
  awardId?: string;
  amountCents?: number;
  registrationId?: string;
}

/**
 * The missing half of "close an item": closing silent bidding was only
 * ever flipping the status column (whether done by an admin's Close
 * button, the staggered-close sweep, or placeBid's own defense-in-depth
 * check) without ever resolving who won — a pre-existing gap flagged
 * during item 9's work and left alone then to avoid scope creep. Item
 * 17's full event-flow test (check in -> bid -> outbid -> close ->
 * checkout -> receipt -> sync) can't actually reach checkout without
 * this, so fixing it here: whoever's leading when an item closes gets
 * an Award at the resolved current price, same as the live clerk's
 * hammer-price entry produces; with no bids at all, the item is UNSOLD,
 * not just silently CLOSED with nothing to show for it.
 */
export async function closeItemAndAward(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itemId: string,
): Promise<CloseItemAndAwardResult> {
  const item = await tx.auctionItem.findUniqueOrThrow({ where: { id: itemId } });
  const positions = await currentPositions(tx, itemId);
  const state = resolveBidPositions(positions, item.startingBidCents ?? 0, item.bidIncrementCents ?? 0);

  if (state.leaderRegistrationId) {
    const award = await tx.award.create({
      data: {
        itemId,
        registrationId: state.leaderRegistrationId,
        amountCents: state.currentAmountCents,
      },
    });
    await tx.auctionItem.update({ where: { id: itemId }, data: { status: "AWARDED" } });
    return {
      status: "AWARDED",
      awardId: award.id,
      amountCents: state.currentAmountCents,
      registrationId: state.leaderRegistrationId,
    };
  }

  await tx.auctionItem.update({ where: { id: itemId }, data: { status: "UNSOLD" } });
  return { status: "UNSOLD" };
}

export async function placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
  assertCents(input.amountCents, "amountCents");

  return prisma
    .$transaction(async (tx) => {
      if (input.clientRequestId) {
        const existing = await tx.bid.findUnique({ where: { clientRequestId: input.clientRequestId } });
        if (existing) {
          const item = await tx.auctionItem.findUniqueOrThrow({ where: { id: input.itemId } });
          const positions = await currentPositions(tx, input.itemId);
          const state = resolveBidPositions(positions, item.startingBidCents ?? 0, item.bidIncrementCents ?? 0);
          const bidCount = await tx.bid.count({ where: { itemId: input.itemId, voidedAt: null } });
          return {
            bid: existing,
            currentAmountCents: state.currentAmountCents,
            leaderRegistrationId: state.leaderRegistrationId,
            // Same as leaderRegistrationId on purpose — a replay never
            // fires a second outbid notification for a bid that already
            // notified the first time it landed.
            previousLeaderRegistrationId: state.leaderRegistrationId,
            bidCount,
          };
        }
      }

      const item = await lockItemRow(tx, input.itemId);

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

      const increment = item.bidIncrementCents ?? 0;
      const startingBid = item.startingBidCents ?? 0;
      const positionsBefore = (await currentPositions(tx, input.itemId)).filter(
        (p) => p.registrationId !== input.registrationId,
      );
      const stateBefore = resolveBidPositions(positionsBefore, startingBid, increment);
      const minimumRequiredCents = stateBefore.leaderRegistrationId
        ? stateBefore.currentAmountCents + increment
        : startingBid;

      if (input.amountCents < minimumRequiredCents) {
        throw new BidTooLowError(`Minimum bid is ${minimumRequiredCents} cents`, minimumRequiredCents);
      }

      const bid = await tx.bid.create({
        data: {
          itemId: input.itemId,
          registrationId: input.registrationId,
          amountCents: input.amountCents,
          source: input.source,
          isMaxBid: input.isMaxBid ?? false,
          clientRequestId: input.clientRequestId,
        },
      });

      const positionsAfter = [
        ...positionsBefore,
        { registrationId: input.registrationId, amountCents: input.amountCents, isMaxBid: input.isMaxBid ?? false, placedAt: bid.placedAt },
      ];
      const stateAfter = resolveBidPositions(positionsAfter, startingBid, increment);

      const bidCount = await tx.bid.count({ where: { itemId: input.itemId, voidedAt: null } });

      return {
        bid,
        currentAmountCents: stateAfter.currentAmountCents,
        leaderRegistrationId: stateAfter.leaderRegistrationId,
        previousLeaderRegistrationId: stateBefore.leaderRegistrationId,
        bidCount,
      };
    })
    .catch(async (err) => {
      // Two concurrent retries of the exact same clientRequestId (the
      // offline queue only retries sequentially, but a rare double-submit
      // from the client is cheap to guard against): one wins the insert,
      // the other hits the unique constraint. Recover the same way the
      // in-transaction replay branch above does, rather than surfacing a
      // raw constraint-violation 500 for what is, from the bidder's
      // perspective, a bid that already succeeded.
      if (
        input.clientRequestId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("clientRequestId")
      ) {
        const existing = await prisma.bid.findUniqueOrThrow({
          where: { clientRequestId: input.clientRequestId },
        });
        const item = await prisma.auctionItem.findUniqueOrThrow({ where: { id: input.itemId } });
        const positions = await currentPositions(prisma, input.itemId);
        const state = resolveBidPositions(positions, item.startingBidCents ?? 0, item.bidIncrementCents ?? 0);
        const bidCount = await prisma.bid.count({ where: { itemId: input.itemId, voidedAt: null } });
        return {
          bid: existing,
          currentAmountCents: state.currentAmountCents,
          leaderRegistrationId: state.leaderRegistrationId,
          previousLeaderRegistrationId: state.leaderRegistrationId,
          bidCount,
        };
      }
      await closeExpiredItem(err);
      throw err;
    })
    .then(async (result) => {
      // Best-effort, after the transaction above has committed: the
      // previous leader (if any, and if different from the new one) just
      // got outbid. No-ops instantly if ENABLE_OUTBID_SMS is off.
      if (
        result.previousLeaderRegistrationId &&
        result.previousLeaderRegistrationId !== result.leaderRegistrationId
      ) {
        notifyOutbid(input.itemId, result.previousLeaderRegistrationId, result.currentAmountCents).catch(
          (err) => console.error("notifyOutbid failed for item", input.itemId, err),
        );
      }

      // Publish only after the transaction above has committed.
      const leaderRegistration = result.leaderRegistrationId
        ? await prisma.registration.findUnique({
            where: { id: result.leaderRegistrationId },
            select: { bidderNumber: true },
          })
        : null;
      await publishBidUpdate({
        itemId: input.itemId,
        currentAmountCents: result.currentAmountCents,
        leadingBidderNumber: leaderRegistration?.bidderNumber ?? null,
        bidCount: result.bidCount,
        serverTimestamp: new Date().toISOString(),
      });
      return { bid: result.bid, currentAmountCents: result.currentAmountCents, bidCount: result.bidCount };
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
  const [item, positions, bidCount] = await Promise.all([
    prisma.auctionItem.findUniqueOrThrow({ where: { id: itemId } }),
    (async () => {
      const bids = await prisma.bid.findMany({
        where: { itemId, voidedAt: null },
        select: { registrationId: true, amountCents: true, isMaxBid: true, placedAt: true },
      });
      return latestPositionPerRegistration(bids);
    })(),
    prisma.bid.count({ where: { itemId, voidedAt: null } }),
  ]);

  const state = resolveBidPositions(positions, item.startingBidCents ?? 0, item.bidIncrementCents ?? 0);
  const leaderRegistration = state.leaderRegistrationId
    ? await prisma.registration.findUnique({
        where: { id: state.leaderRegistrationId },
        select: { bidderNumber: true },
      })
    : null;

  return {
    itemId,
    currentAmountCents: state.currentAmountCents,
    leadingBidderNumber: leaderRegistration?.bidderNumber ?? null,
    bidCount,
  };
}

/**
 * Buy-it-now (Event night, item 9): ends bidding immediately and awards
 * the item to this registration at the item's fixed buyNowCents price —
 * a different mechanism from the clerk's hammer-price entry (that's for
 * live items an auctioneer calls out loud; this is a silent item a
 * bidder ends themselves from their phone).
 */
export async function buyItNow(
  itemId: string,
  registrationId: string,
  actorId: string,
): Promise<Award> {
  const awardId = randomUUID();

  let award: Award;
  try {
    award = await auditedMutation({
      actorId,
      entityType: "Award",
      entityId: awardId,
      action: "buy_it_now",
      before: async () => null,
      mutate: async (tx) => {
        const item = await lockItemRow(tx, itemId);
        if (!item.buyNowCents) {
          throw new BuyNowUnavailableError("This item doesn't have a buy-it-now price.");
        }

        const positions = await currentPositions(tx, itemId);
        const state = resolveBidPositions(positions, item.startingBidCents ?? 0, item.bidIncrementCents ?? 0);
        if (state.currentAmountCents >= item.buyNowCents) {
          throw new BuyNowUnavailableError(
            "Bidding has already reached the buy-it-now price — place a regular bid instead.",
          );
        }

        await tx.bid.create({
          data: {
            itemId,
            registrationId,
            amountCents: item.buyNowCents,
            source: "MOBILE",
            isMaxBid: false,
          },
        });

        const created = await tx.award.create({
          data: { id: awardId, itemId, registrationId, amountCents: item.buyNowCents },
        });

        await tx.auctionItem.update({ where: { id: itemId }, data: { status: "AWARDED" } });

        return created;
      },
      after: async (_tx, result) => result,
    });
  } catch (err) {
    // Same reason as placeBid's .catch(): a closeAt-expiry throw rolls
    // back any status write made inside the transaction above, so the
    // actual CLOSED write has to happen out here, after it unwinds.
    await closeExpiredItem(err);
    throw err;
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { bidderNumber: true },
  });
  await publishBidUpdate({
    itemId,
    currentAmountCents: award.amountCents,
    leadingBidderNumber: registration?.bidderNumber ?? null,
    bidCount: await prisma.bid.count({ where: { itemId, voidedAt: null } }),
    serverTimestamp: new Date().toISOString(),
  });

  return award;
}
