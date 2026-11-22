import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { placeBid } from "@/lib/auction/bidding";
import { FakeSmsAdapter } from "./fake-adapter";
import { setSmsAdapterForTesting } from "./index";
import { AuctionItemStatus, AuctionItemType } from "@prisma/client";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

/** notifyOutbid runs in placeBid's fire-and-forget .then() — give it a
 * moment to land before asserting, same pattern as the receipt-email test. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe.skipIf(!dbAvailable)("outbid SMS notifications", () => {
  const createdOrgIds: string[] = [];
  const originalFlag = process.env.ENABLE_OUTBID_SMS;

  beforeEach(() => {
    process.env.ENABLE_OUTBID_SMS = "true";
  });

  afterEach(() => {
    process.env.ENABLE_OUTBID_SMS = originalFlag;
    setSmsAdapterForTesting(undefined);
  });

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

  async function setupItem() {
    const org = await prisma.organization.create({ data: { name: `Outbid SMS Test Org ${Date.now()}` } });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: { orgId: org.id, name: "SMS Test Event", eventDate: new Date("2027-04-15T00:00:00Z"), taxYear: 2027 },
    });
    const item = await prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "T1",
        title: "Texted Item",
        itemType: AuctionItemType.SILENT,
        fmvCents: 1_000,
        status: AuctionItemStatus.OPEN,
        startingBidCents: 1_000,
        bidIncrementCents: 100,
      },
    });
    async function makeRegistration(bidderNumber: number, phone?: string) {
      const constituent = await prisma.constituent.create({
        data: { orgId: org.id, firstName: "Bidder", lastName: String(bidderNumber), phone },
      });
      return prisma.registration.create({
        data: { eventId: event.id, constituentId: constituent.id, bidderNumber },
      });
    }
    return { item, makeRegistration };
  }

  it("texts the previous leader when someone else outbids them", async () => {
    const fake = new FakeSmsAdapter();
    setSmsAdapterForTesting(fake);
    const { item, makeRegistration } = await setupItem();
    const reg1 = await makeRegistration(101, "555-0101");
    const reg2 = await makeRegistration(102, "555-0102");

    await placeBid({ itemId: item.id, registrationId: reg1.id, amountCents: 1_000, source: "MOBILE" });
    await placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_100, source: "MOBILE" });
    await flush();

    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].to).toBe("555-0101");
    expect(fake.sent[0].body).toContain("outbid");
    expect(fake.sent[0].body).toContain("$11.00");
  });

  it("sends nothing on the very first bid — no one to outbid yet", async () => {
    const fake = new FakeSmsAdapter();
    setSmsAdapterForTesting(fake);
    const { item, makeRegistration } = await setupItem();
    const reg = await makeRegistration(101, "555-0201");

    await placeBid({ itemId: item.id, registrationId: reg.id, amountCents: 1_000, source: "MOBILE" });
    await flush();

    expect(fake.sent).toHaveLength(0);
  });

  it("sends nothing when the feature flag is off", async () => {
    process.env.ENABLE_OUTBID_SMS = "false";
    const fake = new FakeSmsAdapter();
    setSmsAdapterForTesting(fake);
    const { item, makeRegistration } = await setupItem();
    const reg1 = await makeRegistration(101, "555-0301");
    const reg2 = await makeRegistration(102, "555-0302");

    await placeBid({ itemId: item.id, registrationId: reg1.id, amountCents: 1_000, source: "MOBILE" });
    await placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_100, source: "MOBILE" });
    await flush();

    expect(fake.sent).toHaveLength(0);
  });

  it("sends nothing when the outbid bidder has no phone on file", async () => {
    const fake = new FakeSmsAdapter();
    setSmsAdapterForTesting(fake);
    const { item, makeRegistration } = await setupItem();
    const reg1 = await makeRegistration(101); // no phone
    const reg2 = await makeRegistration(102, "555-0401");

    await placeBid({ itemId: item.id, registrationId: reg1.id, amountCents: 1_000, source: "MOBILE" });
    await placeBid({ itemId: item.id, registrationId: reg2.id, amountCents: 1_100, source: "MOBILE" });
    await flush();

    expect(fake.sent).toHaveLength(0);
  });
});
