import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BID_RATE_LIMIT_MS,
  BidRateLimitError,
  BidTooLowError,
  BuyNowUnavailableError,
  buyItNow,
  getItemBidState,
  ItemNotOpenError,
  placeBid,
  resolveBidPositions,
} from "./bidding";
import { AuctionItemStatus, AuctionItemType } from "@prisma/client";

describe("resolveBidPositions (pure)", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  const t = (secondsLater: number) => new Date(now.getTime() + secondsLater * 1000);

  it("shows the starting bid with no positions at all", () => {
    const state = resolveBidPositions([], 1_000, 100);
    expect(state).toEqual({ currentAmountCents: 1_000, leaderRegistrationId: null });
  });

  it("a plain bid displays at exactly its own amount when uncontested", () => {
    const state = resolveBidPositions(
      [{ registrationId: "a", amountCents: 1_500, isMaxBid: false, placedAt: t(0) }],
      1_000,
      100,
    );
    expect(state).toEqual({ currentAmountCents: 1_500, leaderRegistrationId: "a" });
  });

  it("a solo max bid reveals nothing — displays only the starting bid", () => {
    const state = resolveBidPositions(
      [{ registrationId: "a", amountCents: 5_000, isMaxBid: true, placedAt: t(0) }],
      1_000,
      100,
    );
    expect(state).toEqual({ currentAmountCents: 1_000, leaderRegistrationId: "a" });
  });

  it("a max bid shows only enough to beat a plain bid by one increment", () => {
    const state = resolveBidPositions(
      [
        { registrationId: "plain", amountCents: 2_000, isMaxBid: false, placedAt: t(0) },
        { registrationId: "proxy", amountCents: 10_000, isMaxBid: true, placedAt: t(1) },
      ],
      1_000,
      100,
    );
    expect(state).toEqual({ currentAmountCents: 2_100, leaderRegistrationId: "proxy" });
  });

  it("two competing max bids settle one increment above the loser's ceiling", () => {
    const state = resolveBidPositions(
      [
        { registrationId: "low-max", amountCents: 3_000, isMaxBid: true, placedAt: t(0) },
        { registrationId: "high-max", amountCents: 5_000, isMaxBid: true, placedAt: t(1) },
      ],
      1_000,
      100,
    );
    expect(state).toEqual({ currentAmountCents: 3_100, leaderRegistrationId: "high-max" });
  });

  it("a max bid never displays above its own ceiling, even if that's below the pressure floor", () => {
    // high-max's ceiling (3,000) is less than low-max's ceiling + increment (2,100) would
    // suggest is "needed" the other way around — here high-max's own ceiling is the binding cap.
    const state = resolveBidPositions(
      [
        { registrationId: "a", amountCents: 2_900, isMaxBid: true, placedAt: t(0) },
        { registrationId: "b", amountCents: 3_000, isMaxBid: true, placedAt: t(1) },
      ],
      1_000,
      100,
    );
    // b leads (higher ceiling); displayed is min(3000, 2900+100=3000) = 3000.
    expect(state).toEqual({ currentAmountCents: 3_000, leaderRegistrationId: "b" });
  });

  it("an earlier max bid wins an exact tie", () => {
    const state = resolveBidPositions(
      [
        { registrationId: "first", amountCents: 4_000, isMaxBid: true, placedAt: t(0) },
        { registrationId: "second", amountCents: 4_000, isMaxBid: true, placedAt: t(1) },
      ],
      1_000,
      100,
    );
    expect(state.leaderRegistrationId).toBe("first");
  });

  it("only the latest position per registration counts", () => {
    const state = resolveBidPositions(
      [
        { registrationId: "a", amountCents: 1_000, isMaxBid: false, placedAt: t(0) },
        { registrationId: "a", amountCents: 2_000, isMaxBid: false, placedAt: t(1) },
      ],
      1_000,
      100,
    );
    expect(state).toEqual({ currentAmountCents: 2_000, leaderRegistrationId: "a" });
  });
});

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("placeBid", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      const items = await prisma.auctionItem.findMany({
        where: { eventId: { in: eventIds } },
      });
      const itemIds = items.map((i) => i.id);
      await prisma.bid.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.auctionItem.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupOpenItem(label: string, overrides: Partial<{ startingBidCents: number; bidIncrementCents: number }> = {}) {
    const org = await prisma.organization.create({
      data: { name: `Bidding Test Org ${label} ${Date.now()}` },
    });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: `Bidding Test Event ${label}`,
        eventDate: new Date("2027-04-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    const item = await prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "A1",
        title: "Test Item",
        itemType: AuctionItemType.SILENT,
        fmvCents: 1_000,
        status: AuctionItemStatus.OPEN,
        startingBidCents: overrides.startingBidCents ?? 1_000,
        bidIncrementCents: overrides.bidIncrementCents ?? 100,
      },
    });

    async function makeRegistration(bidderNumber: number) {
      const constituent = await prisma.constituent.create({
        data: { orgId: org.id, firstName: "Bidder", lastName: String(bidderNumber) },
      });
      return prisma.registration.create({
        data: { eventId: event.id, constituentId: constituent.id, bidderNumber },
      });
    }

    return { org, event, item, makeRegistration };
  }

  it("accepts a bid at or above the starting bid when there is no prior bid", async () => {
    const { item, makeRegistration } = await setupOpenItem("starting-bid");
    const reg = await makeRegistration(101);

    const result = await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 1_000,
      source: "MOBILE",
    });

    expect(result.currentAmountCents).toBe(1_000);
    expect(result.bidCount).toBe(1);
  });

  it("rejects a bid below the starting bid", async () => {
    const { item, makeRegistration } = await setupOpenItem("below-starting");
    const reg = await makeRegistration(101);

    await expect(
      placeBid({
        itemId: item.id,
        registrationId: reg.id,
        amountCents: 500,
        source: "MOBILE",
      }),
    ).rejects.toThrow(BidTooLowError);
  });

  it("requires each subsequent bid to clear the prior bid by the increment", async () => {
    const { item, makeRegistration } = await setupOpenItem("increment");
    const reg1 = await makeRegistration(101);
    const reg2 = await makeRegistration(102);

    await placeBid({ itemId: item.id, registrationId: reg1.id, amountCents: 1_000, source: "MOBILE" });

    // Same amount as the current high bid — must be rejected, not tied.
    await expect(
      placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_000, source: "MOBILE" }),
    ).rejects.toThrow(BidTooLowError);

    // One cent short of the required increment — rejected.
    await expect(
      placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_099, source: "MOBILE" }),
    ).rejects.toThrow(BidTooLowError);

    // Exactly current + increment — accepted.
    const result = await placeBid({
      itemId: item.id,
      registrationId: reg2.id,
      amountCents: 1_100,
      source: "MOBILE",
    });
    expect(result.currentAmountCents).toBe(1_100);
    expect(result.bidCount).toBe(2);
  });

  it("rejects a bid on an item that isn't OPEN", async () => {
    const { item, makeRegistration, event } = await setupOpenItem("not-open");
    await prisma.auctionItem.update({ where: { id: item.id }, data: { status: "CLOSED" } });
    const reg = await makeRegistration(101);
    void event;

    await expect(
      placeBid({ itemId: item.id, registrationId: reg.id, amountCents: 1_000, source: "MOBILE" }),
    ).rejects.toThrow(ItemNotOpenError);
  });

  it("rate limits rapid repeat bids from the same registration", async () => {
    const { item, makeRegistration } = await setupOpenItem("rate-limit");
    const reg = await makeRegistration(101);

    await placeBid({ itemId: item.id, registrationId: reg.id, amountCents: 1_000, source: "MOBILE" });
    await expect(
      placeBid({ itemId: item.id, registrationId: reg.id, amountCents: 1_100, source: "MOBILE" }),
    ).rejects.toThrow(BidRateLimitError);
  }, 10_000);

  it("allows a bid again once the rate limit window passes", async () => {
    const { item, makeRegistration } = await setupOpenItem("rate-limit-window");
    const reg = await makeRegistration(101);

    await placeBid({ itemId: item.id, registrationId: reg.id, amountCents: 1_000, source: "MOBILE" });
    await new Promise((resolve) => setTimeout(resolve, BID_RATE_LIMIT_MS + 200));
    const result = await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 1_100,
      source: "MOBILE",
    });
    expect(result.currentAmountCents).toBe(1_100);
  }, 10_000);

  it("under concurrent identical bids, only one wins and the loser sees a clear rejection", async () => {
    const { item, makeRegistration } = await setupOpenItem("race");
    const reg1 = await makeRegistration(101);
    const reg2 = await makeRegistration(102);

    // Both bidders race to be first at exactly the starting bid.
    const results = await Promise.allSettled([
      placeBid({ itemId: item.id, registrationId: reg1.id, amountCents: 1_000, source: "MOBILE" }),
      placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_000, source: "MOBILE" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const state = await getItemBidState(item.id);
    expect(state.currentAmountCents).toBe(1_000);
    expect(state.bidCount).toBe(1);
  });

  it("a max bid wins immediately but only reveals the starting bid when uncontested", async () => {
    const { item, makeRegistration } = await setupOpenItem("max-solo");
    const reg = await makeRegistration(101);

    const result = await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 5_000,
      source: "MOBILE",
      isMaxBid: true,
    });

    expect(result.currentAmountCents).toBe(1_000); // starting bid, nothing revealed
    const state = await getItemBidState(item.id);
    expect(state.currentAmountCents).toBe(1_000);
    expect(state.leadingBidderNumber).toBe(101);
  });

  it("a plain bid against a standing max bid auto-raises the proxy to stay ahead by one increment", async () => {
    const { item, makeRegistration } = await setupOpenItem("max-vs-plain", { startingBidCents: 1_000, bidIncrementCents: 100 });
    const proxy = await makeRegistration(101);
    const challenger = await makeRegistration(102);

    await placeBid({ itemId: item.id, registrationId: proxy.id, amountCents: 5_000, source: "MOBILE", isMaxBid: true });

    // The proxy is already the (silent) leader at the starting bid, so a new
    // bid still has to clear it by one increment — 1,000 + 100 = 1,100 — even
    // though nothing visible has been "shown" yet.
    const challengeResult = await placeBid({
      itemId: item.id,
      registrationId: challenger.id,
      amountCents: 1_100,
      source: "MOBILE",
    });
    // Resolution is global, not "whatever you just submitted" — the proxy
    // auto-raises past the challenger's bid in the very same result.
    expect(challengeResult.currentAmountCents).toBe(1_200);
    const state = await getItemBidState(item.id);
    expect(state.currentAmountCents).toBe(1_200);
    expect(state.leadingBidderNumber).toBe(101);
  });

  it("rejects a plain bid that doesn't clear the silently-leading max bid by an increment", async () => {
    const { item, makeRegistration } = await setupOpenItem("max-blocks-low-plain");
    const proxy = await makeRegistration(101);
    const challenger = await makeRegistration(102);

    await placeBid({ itemId: item.id, registrationId: proxy.id, amountCents: 5_000, source: "MOBILE", isMaxBid: true });

    // The proxy is already leading at the starting bid (1,000); a bid merely
    // matching the starting bid doesn't clear it by the required increment.
    await expect(
      placeBid({ itemId: item.id, registrationId: challenger.id, amountCents: 1_000, source: "MOBILE" }),
    ).rejects.toThrow(BidTooLowError);
  });

  it("two competing max bids settle one increment above the loser's ceiling", async () => {
    const { item, makeRegistration } = await setupOpenItem("max-vs-max");
    const lowMax = await makeRegistration(101);
    const highMax = await makeRegistration(102);

    await placeBid({ itemId: item.id, registrationId: lowMax.id, amountCents: 3_000, source: "MOBILE", isMaxBid: true });
    await placeBid({ itemId: item.id, registrationId: highMax.id, amountCents: 5_000, source: "MOBILE", isMaxBid: true });

    const state = await getItemBidState(item.id);
    expect(state.currentAmountCents).toBe(3_100);
    expect(state.leadingBidderNumber).toBe(102);
  });

  // Event night, item 15: offline resilience. The client's queue resends
  // the same clientRequestId on every retry of one bid attempt; these
  // confirm a retry never creates a second bid or double-counts.
  it("a repeated clientRequestId doesn't create a second bid", async () => {
    const { item, makeRegistration } = await setupOpenItem("idempotent-retry");
    const reg = await makeRegistration(101);
    const clientRequestId = "test-client-request-id-1";

    const first = await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 1_000,
      source: "MOBILE",
      clientRequestId,
    });
    const replay = await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 1_000,
      source: "MOBILE",
      clientRequestId,
    });

    expect(replay.bid.id).toBe(first.bid.id);
    expect(replay.currentAmountCents).toBe(1_000);
    expect(replay.bidCount).toBe(1); // not 2 — the retry didn't insert a second bid

    const bidRows = await prisma.bid.count({ where: { itemId: item.id } });
    expect(bidRows).toBe(1);
  });

  it("a replay still reflects state that changed since the original bid landed", async () => {
    const { item, makeRegistration } = await setupOpenItem("idempotent-replay-then-outbid");
    const reg1 = await makeRegistration(101);
    const reg2 = await makeRegistration(102);
    const clientRequestId = "test-client-request-id-2";

    await placeBid({
      itemId: item.id,
      registrationId: reg1.id,
      amountCents: 1_000,
      source: "MOBILE",
      clientRequestId,
    });
    await placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_100, source: "MOBILE" });

    // reg1's client retries its original (already-landed) request after
    // reg2 has since outbid it — the replay must report the current
    // state, not stale data from the moment it first landed.
    const replay = await placeBid({
      itemId: item.id,
      registrationId: reg1.id,
      amountCents: 1_000,
      source: "MOBILE",
      clientRequestId,
    });
    expect(replay.currentAmountCents).toBe(1_100);
    expect(replay.bidCount).toBe(2);

    const bidRows = await prisma.bid.count({ where: { itemId: item.id } });
    expect(bidRows).toBe(2);
  });

  it("a replay does not re-trip the rate limit a fresh bid would hit", async () => {
    const { item, makeRegistration } = await setupOpenItem("idempotent-vs-rate-limit");
    const reg = await makeRegistration(101);
    const clientRequestId = "test-client-request-id-3";

    await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 1_000,
      source: "MOBILE",
      clientRequestId,
    });

    // Immediately retried, well inside the rate-limit window — must
    // still succeed as a replay, not fail as "bidding too fast".
    const replay = await placeBid({
      itemId: item.id,
      registrationId: reg.id,
      amountCents: 1_000,
      source: "MOBILE",
      clientRequestId,
    });
    expect(replay.bidCount).toBe(1);
  });
});

describe.skipIf(!dbAvailable)("buyItNow", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      const items = await prisma.auctionItem.findMany({ where: { eventId: { in: eventIds } } });
      const itemIds = items.map((i) => i.id);
      await prisma.award.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.bid.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.auctionItem.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupBuyNowItem(label: string, buyNowCents: number | null) {
    const org = await prisma.organization.create({ data: { name: `Buy Now Test Org ${label} ${Date.now()}` } });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: { orgId: org.id, name: `Buy Now Test ${label}`, eventDate: new Date("2027-04-15T00:00:00Z"), taxYear: 2027 },
    });
    const item = await prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "B1",
        title: "Buy Now Item",
        itemType: AuctionItemType.SILENT,
        fmvCents: 1_000,
        status: AuctionItemStatus.OPEN,
        startingBidCents: 1_000,
        bidIncrementCents: 100,
        buyNowCents: buyNowCents ?? undefined,
      },
    });
    const constituent = await prisma.constituent.create({ data: { orgId: org.id, firstName: "Buyer", lastName: "One" } });
    const registration = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 201 },
    });
    return { item, registration };
  }

  it("ends bidding and awards the item at the buy-now price", async () => {
    const { item, registration } = await setupBuyNowItem("basic", 10_000);
    const award = await buyItNow(item.id, registration.id, "admin");

    expect(award.amountCents).toBe(10_000);
    expect(award.registrationId).toBe(registration.id);

    const updated = await prisma.auctionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.status).toBe("AWARDED");
  });

  it("refuses when the item has no buy-now price set", async () => {
    const { item, registration } = await setupBuyNowItem("no-price", null);
    await expect(buyItNow(item.id, registration.id, "admin")).rejects.toThrow(BuyNowUnavailableError);
  });

  it("refuses once bidding already reached the buy-now price", async () => {
    const { item, registration } = await setupBuyNowItem("already-there", 2_000);
    await placeBid({ itemId: item.id, registrationId: registration.id, amountCents: 2_000, source: "MOBILE" });
    await expect(buyItNow(item.id, registration.id, "admin")).rejects.toThrow(BuyNowUnavailableError);
  });
});
