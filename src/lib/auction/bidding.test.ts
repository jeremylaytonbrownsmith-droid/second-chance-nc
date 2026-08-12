import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BID_RATE_LIMIT_MS,
  BidRateLimitError,
  BidTooLowError,
  getItemBidState,
  ItemNotOpenError,
  placeBid,
} from "./bidding";
import { AuctionItemStatus, AuctionItemType } from "@prisma/client";

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
});
