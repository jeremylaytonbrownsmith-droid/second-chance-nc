import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeExpiredItemsForEvent, setCategoryCloseTime } from "./auction-items";
import { placeBid, ItemNotOpenError } from "@/lib/auction/bidding";
import { AuctionItemStatus, AuctionItemType } from "@prisma/client";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("staggered close by category", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      const items = await prisma.auctionItem.findMany({ where: { eventId: { in: eventIds } } });
      const itemIds = items.map((i) => i.id);
      await prisma.bid.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.auctionItem.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupEvent() {
    const org = await prisma.organization.create({ data: { name: `Staggered Close Test Org ${Date.now()}` } });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: { orgId: org.id, name: "Staggered Close Test", eventDate: new Date("2027-04-15T00:00:00Z"), taxYear: 2027 },
    });
    return { org, event };
  }

  it("sets closeAt on every item in a category, not other categories", async () => {
    const { event } = await setupEvent();
    await prisma.auctionItem.create({
      data: { eventId: event.id, itemNumber: "G1", title: "Getaway 1", category: "Getaways", itemType: AuctionItemType.SILENT, status: AuctionItemStatus.OPEN },
    });
    await prisma.auctionItem.create({
      data: { eventId: event.id, itemNumber: "G2", title: "Getaway 2", category: "Getaways", itemType: AuctionItemType.SILENT, status: AuctionItemStatus.OPEN },
    });
    await prisma.auctionItem.create({
      data: { eventId: event.id, itemNumber: "A1", title: "Art 1", category: "Art", itemType: AuctionItemType.SILENT, status: AuctionItemStatus.OPEN },
    });

    const closeAt = new Date("2027-04-15T20:00:00Z");
    const { count } = await setCategoryCloseTime(event.id, "Getaways", closeAt, "admin");
    expect(count).toBe(2);

    const items = await prisma.auctionItem.findMany({ where: { eventId: event.id }, orderBy: { itemNumber: "asc" } });
    expect(items.find((i) => i.itemNumber === "G1")?.closeAt?.toISOString()).toBe(closeAt.toISOString());
    expect(items.find((i) => i.itemNumber === "G2")?.closeAt?.toISOString()).toBe(closeAt.toISOString());
    expect(items.find((i) => i.itemNumber === "A1")?.closeAt).toBeNull();
  });

  it("closeExpiredItemsForEvent flips only OPEN items whose closeAt has passed", async () => {
    const { event } = await setupEvent();
    const past = await prisma.auctionItem.create({
      data: {
        eventId: event.id, itemNumber: "P1", title: "Past", itemType: AuctionItemType.SILENT,
        status: AuctionItemStatus.OPEN, closeAt: new Date(Date.now() - 60_000),
      },
    });
    const future = await prisma.auctionItem.create({
      data: {
        eventId: event.id, itemNumber: "F1", title: "Future", itemType: AuctionItemType.SILENT,
        status: AuctionItemStatus.OPEN, closeAt: new Date(Date.now() + 60_000),
      },
    });
    const noClose = await prisma.auctionItem.create({
      data: { eventId: event.id, itemNumber: "N1", title: "No close time", itemType: AuctionItemType.SILENT, status: AuctionItemStatus.OPEN },
    });

    await closeExpiredItemsForEvent(event.id);

    const [pastAfter, futureAfter, noCloseAfter] = await Promise.all([
      prisma.auctionItem.findUniqueOrThrow({ where: { id: past.id } }),
      prisma.auctionItem.findUniqueOrThrow({ where: { id: future.id } }),
      prisma.auctionItem.findUniqueOrThrow({ where: { id: noClose.id } }),
    ]);
    expect(pastAfter.status).toBe("CLOSED");
    expect(futureAfter.status).toBe("OPEN");
    expect(noCloseAfter.status).toBe("OPEN");
  });

  it("placeBid refuses a bid once closeAt has passed, even if the sweep hasn't run yet", async () => {
    const { org, event } = await setupEvent();
    const item = await prisma.auctionItem.create({
      data: {
        eventId: event.id, itemNumber: "E1", title: "Expired", itemType: AuctionItemType.SILENT,
        status: AuctionItemStatus.OPEN, startingBidCents: 1_000, bidIncrementCents: 100,
        closeAt: new Date(Date.now() - 1_000), // already in the past, status column still says OPEN
      },
    });
    const constituent = await prisma.constituent.create({ data: { orgId: org.id, firstName: "Late", lastName: "Bidder" } });
    const registration = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 101 },
    });

    await expect(
      placeBid({ itemId: item.id, registrationId: registration.id, amountCents: 1_000, source: "MOBILE" }),
    ).rejects.toThrow(ItemNotOpenError);

    const after = await prisma.auctionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.status).toBe("CLOSED"); // the attempt itself closes it out
  });
});
