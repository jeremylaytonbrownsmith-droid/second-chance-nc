import { prisma } from "@/lib/prisma";
import {
  AuctionItemStatus,
  AuctionItemType,
  EventStatus,
  RegistrationStatus,
} from "@prisma/client";

/**
 * Section 14: demo/simulation mode. A seeded demo event with fake
 * constituents and items with real FMV values, plus a reset command that
 * returns it to a known state. Never mixed with real donor data — every
 * row created here belongs to an Organization/Event with isDemo: true,
 * and every screen that reads demo data must show the demo banner.
 */

const DEMO_ORG_NAME = "Second Chance Pet Adoptions (Demo)";

/** Wipes any existing demo org and everything under it, then recreates a
 * fresh, fully-populated demo event. Safe to call repeatedly. */
export async function resetDemoData() {
  const existing = await prisma.organization.findFirst({
    where: { isDemo: true, name: DEMO_ORG_NAME },
    include: { events: true },
  });

  if (existing) {
    const eventIds = existing.events.map((e) => e.id);
    // SyncLog.localId holds transaction ids, not event ids — collect them
    // before the transactions themselves are deleted below, or the old
    // sync log rows are orphaned and pile up across every reset instead
    // of clearing.
    const transactionIds = (
      await prisma.transaction.findMany({
        where: { eventId: { in: eventIds } },
        select: { id: true },
      })
    ).map((t) => t.id);

    await prisma.transactionLine.deleteMany({
      where: { transaction: { eventId: { in: eventIds } } },
    });
    await prisma.transaction.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.bid.deleteMany({ where: { item: { eventId: { in: eventIds } } } });
    await prisma.award.deleteMany({ where: { item: { eventId: { in: eventIds } } } });
    await prisma.auctionItem.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.itemDonor.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.constituent.deleteMany({ where: { orgId: existing.id } });
    await prisma.event.deleteMany({ where: { orgId: existing.id } });
    await prisma.syncLog.deleteMany({
      where: {
        entityType: "GIFT",
        localId: { in: transactionIds.length ? transactionIds : ["__none__"] },
      },
    });
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      ein: "00-0000000",
      fiscalYearStart: 1,
      isDemo: true,
    },
  });

  const eventDate = new Date();
  eventDate.setUTCDate(eventDate.getUTCDate() + 30);

  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      name: "2027 Evening of Pawsibilities (Demo)",
      eventDate,
      taxYear: eventDate.getUTCFullYear(),
      status: EventStatus.OPEN,
      isDemo: true,
    },
  });

  const [jamie, pat, morgan, alex, acmeVet] = await Promise.all([
    prisma.constituent.create({
      data: {
        orgId: org.id,
        firstName: "Jamie",
        lastName: "Rivera",
        email: "jamie.demo@example.com",
        phone: "555-0101",
      },
    }),
    prisma.constituent.create({
      data: {
        orgId: org.id,
        firstName: "Pat",
        lastName: "Nguyen",
        email: "pat.demo@example.com",
        phone: "555-0102",
      },
    }),
    prisma.constituent.create({
      data: {
        orgId: org.id,
        firstName: "Morgan",
        lastName: "Lee",
        email: "morgan.demo@example.com",
        phone: "555-0103",
      },
    }),
    prisma.constituent.create({
      data: {
        orgId: org.id,
        firstName: "Alex",
        lastName: "Kim",
        email: "alex.demo@example.com",
        phone: "555-0104",
      },
    }),
    prisma.constituent.create({
      data: {
        orgId: org.id,
        isBusiness: true,
        orgName: "Acme Vet Supply",
        email: "gifts.demo@acmevet.example",
      },
    }),
  ]);

  const itemDonor = await prisma.itemDonor.create({
    data: {
      eventId: event.id,
      constituentId: acmeVet.id,
      claimedValueCents: 60_000, // $600 — triggers the 8283 flag
      substantiationNeeded: true,
    },
  });

  const [lakeHouse, artPiece] = await Promise.all([
    prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "S1",
        title: "Weekend at the Lake House",
        description: "A three-night stay at a donated lake house.",
        category: "Getaways",
        itemType: AuctionItemType.SILENT,
        fmvCents: 15_000,
        fmvBasis: "Comparable weekend rental listings",
        startingBidCents: 5_000,
        bidIncrementCents: 500,
        status: AuctionItemStatus.OPEN,
        itemDonorId: itemDonor.id,
      },
    }),
    prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "L1",
        title: "Signed Local Artist Painting",
        description: "Original piece donated by a local artist.",
        category: "Art",
        itemType: AuctionItemType.LIVE,
        fmvCents: 20_000,
        fmvBasis: "Artist's gallery price for comparable work",
        startingBidCents: 10_000,
        bidIncrementCents: 1_000,
        status: AuctionItemStatus.OPEN,
      },
    }),
    prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "R1",
        title: "50/50 Raffle",
        itemType: AuctionItemType.RAFFLE,
        fmvCents: 0,
        fmvBasis: "No goods or services received",
        status: AuctionItemStatus.OPEN,
        quantity: 999,
      },
    }),
    prisma.auctionItem.create({
      data: {
        eventId: event.id,
        itemNumber: "F1",
        title: "Fund a Need: Emergency Vet Fund",
        itemType: AuctionItemType.FUND_A_NEED,
        fmvCents: 0,
        fmvBasis: "No goods or services received",
        status: AuctionItemStatus.OPEN,
      },
    }),
  ]);

  const [reg1, reg2, reg3] = await Promise.all([
    prisma.registration.create({
      data: {
        eventId: event.id,
        constituentId: jamie.id,
        bidderNumber: 101,
        checkedInAt: new Date(),
        paymentCustomerRef: "demo-cust-101",
        paymentMethodRef: "demo-pm-101",
        status: RegistrationStatus.CHECKED_IN,
      },
    }),
    prisma.registration.create({
      data: {
        eventId: event.id,
        constituentId: pat.id,
        bidderNumber: 102,
        checkedInAt: new Date(),
        paymentCustomerRef: "demo-cust-102",
        paymentMethodRef: "demo-pm-102",
        status: RegistrationStatus.CHECKED_IN,
      },
    }),
    prisma.registration.create({
      data: {
        eventId: event.id,
        constituentId: morgan.id,
        bidderNumber: 103,
        checkedInAt: new Date(),
        paymentCustomerRef: "demo-cust-103",
        paymentMethodRef: "demo-pm-103",
        status: RegistrationStatus.CHECKED_IN,
      },
    }),
  ]);

  // Alex stays registered but not checked in, to demo that state too.
  await prisma.registration.create({
    data: {
      eventId: event.id,
      constituentId: alex.id,
      bidderNumber: 104,
      status: RegistrationStatus.REGISTERED,
    },
  });

  return {
    org,
    event,
    items: { lakeHouse, artPiece },
    registrations: { reg1, reg2, reg3 },
  };
}

/** Fetches the current demo event, seeding one if none exists yet. */
export async function getOrCreateDemoEvent() {
  const existing = await prisma.event.findFirst({
    where: { isDemo: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  const { event } = await resetDemoData();
  return event;
}
