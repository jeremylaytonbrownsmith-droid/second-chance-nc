import { prisma } from "@/lib/prisma";
import {
  AuctionItemStatus,
  AuctionItemType,
  EventStatus,
  RegistrationStatus,
} from "@prisma/client";

// Fixed, arbitrary key for a Postgres session-level advisory lock scoped to
// this function. Without it, two concurrent callers who both see "no demo
// event yet" (a fresh/empty database — a cold deploy, or two static-
// generation workers racing at build time) each try to create the same
// items/constituents/registrations and collide on unique constraints and
// foreign keys. The lock serializes the whole reset so the second caller
// runs against the first caller's already-committed state instead of
// racing it.
const DEMO_RESET_LOCK_KEY = 727_501;

/**
 * Section 14: demo/simulation mode. A seeded demo event with fake
 * constituents and items with real FMV values, plus a reset command that
 * returns it to a known state. Never mixed with real donor data — every
 * row created here belongs to an Organization/Event with isDemo: true,
 * and every screen that reads demo data must show the demo banner.
 *
 * The Organization/Event themselves are STABLE across resets (update in
 * place, not delete-and-recreate) — real staff data (the Solicitation
 * list, in particular) lives under this event and must survive a reset,
 * not just the seeded bidding/checkout furniture. Only the transactional
 * demo state gets wiped and rebuilt each time.
 */

const DEMO_ORG_NAME = "Second Chance Pet Adoptions (Demo)";

/** Resets the transactional/bidding demo state (items, bids, checkouts,
 * registrations) to a known-good starting point. The demo Organization and
 * Event are found-or-created once and then updated in place on every call
 * — their ids stay stable so real data attached to the event (imported
 * Solicitations, for instance) is never orphaned by a reset. Safe to call
 * repeatedly. */
export async function resetDemoData() {
  return prisma.$transaction(
    async (tx) => {
      // Serializes every concurrent caller onto one at a time, so a cold
      // database (nothing exists yet) can't have two callers both decide
      // to create the demo org/event/items and collide. Released
      // automatically when the transaction ends.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DEMO_RESET_LOCK_KEY})`;

      let org = await tx.organization.findFirst({
        where: { isDemo: true, name: DEMO_ORG_NAME },
      });
      if (!org) {
        org = await tx.organization.create({
          data: { name: DEMO_ORG_NAME, ein: "00-0000000", fiscalYearStart: 1, isDemo: true },
        });
      }

      const eventDate = new Date();
      eventDate.setUTCDate(eventDate.getUTCDate() + 30);

      let event = await tx.event.findFirst({ where: { orgId: org.id, isDemo: true } });
      if (event) {
        event = await tx.event.update({
          where: { id: event.id },
          data: {
            name: "2027 Evening of Pawsibilities (Demo)",
            eventDate,
            taxYear: eventDate.getUTCFullYear(),
            status: EventStatus.OPEN,
            goalCents: 5_000_000,
          },
        });
      } else {
        event = await tx.event.create({
          data: {
            orgId: org.id,
            name: "2027 Evening of Pawsibilities (Demo)",
            eventDate,
            taxYear: eventDate.getUTCFullYear(),
            status: EventStatus.OPEN,
            isDemo: true,
            goalCents: 5_000_000,
          },
        });
      }

      // SyncLog.localId holds transaction ids — collect them before the
      // transactions themselves are deleted below, or the old sync log rows
      // are orphaned and pile up across every reset instead of clearing.
      const transactionIds = (
        await tx.transaction.findMany({ where: { eventId: event.id }, select: { id: true } })
      ).map((t) => t.id);

      await tx.transactionLine.deleteMany({ where: { transaction: { eventId: event.id } } });
      await tx.transaction.deleteMany({ where: { eventId: event.id } });
      await tx.bid.deleteMany({ where: { item: { eventId: event.id } } });
      await tx.award.deleteMany({ where: { item: { eventId: event.id } } });
      // Solicitations are NOT wiped here — real outreach data must survive a
      // reset — but a DONATED one may point at an auction item that's about
      // to be deleted below. Unlink rather than let the FK block the delete;
      // the ask and its DONATED status are still real even once the demo
      // catalog item itself cycles.
      await tx.solicitation.updateMany({
        where: { eventId: event.id, fulfilledAuctionItemId: { not: null } },
        data: { fulfilledAuctionItemId: null },
      });
      await tx.auctionItem.deleteMany({ where: { eventId: event.id } });
      await tx.itemDonor.deleteMany({ where: { eventId: event.id } });
      await tx.registration.deleteMany({ where: { eventId: event.id } });
      // Constituents (demo bidders/donors) belong to registrations and item
      // donors above, not to Solicitation — safe to wipe and recreate.
      await tx.constituent.deleteMany({ where: { orgId: org.id } });
      await tx.syncLog.deleteMany({
        where: {
          entityType: "GIFT",
          localId: { in: transactionIds.length ? transactionIds : ["__none__"] },
        },
      });

      const jamie = await tx.constituent.create({
        data: {
          orgId: org.id,
          firstName: "Jamie",
          lastName: "Rivera",
          email: "jamie.demo@example.com",
          phone: "555-0101",
        },
      });
      const pat = await tx.constituent.create({
        data: {
          orgId: org.id,
          firstName: "Pat",
          lastName: "Nguyen",
          email: "pat.demo@example.com",
          phone: "555-0102",
        },
      });
      const morgan = await tx.constituent.create({
        data: {
          orgId: org.id,
          firstName: "Morgan",
          lastName: "Lee",
          email: "morgan.demo@example.com",
          phone: "555-0103",
        },
      });
      const alex = await tx.constituent.create({
        data: {
          orgId: org.id,
          firstName: "Alex",
          lastName: "Kim",
          email: "alex.demo@example.com",
          phone: "555-0104",
        },
      });
      const acmeVet = await tx.constituent.create({
        data: {
          orgId: org.id,
          isBusiness: true,
          orgName: "Acme Vet Supply",
          email: "gifts.demo@acmevet.example",
        },
      });

      const itemDonor = await tx.itemDonor.create({
        data: {
          eventId: event.id,
          constituentId: acmeVet.id,
          claimedValueCents: 60_000, // $600 — triggers the 8283 flag
          substantiationNeeded: true,
        },
      });

      const lakeHouse = await tx.auctionItem.create({
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
      });
      const artPiece = await tx.auctionItem.create({
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
      });
      await tx.auctionItem.create({
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
      });
      await tx.auctionItem.create({
        data: {
          eventId: event.id,
          itemNumber: "F1",
          title: "Fund a Need: Emergency Vet Fund",
          itemType: AuctionItemType.FUND_A_NEED,
          fmvCents: 0,
          fmvBasis: "No goods or services received",
          status: AuctionItemStatus.OPEN,
        },
      });

      // Solicitations are deliberately not reseeded here — they're real staff
      // data (see resetDemoData's comment above) loaded once via
      // scripts/import-solicitations.ts, not demo furniture rebuilt each run.

      const reg1 = await tx.registration.create({
        data: {
          eventId: event.id,
          constituentId: jamie.id,
          bidderNumber: 101,
          checkedInAt: new Date(),
          paymentCustomerRef: "demo-cust-101",
          paymentMethodRef: "demo-pm-101",
          status: RegistrationStatus.CHECKED_IN,
        },
      });
      const reg2 = await tx.registration.create({
        data: {
          eventId: event.id,
          constituentId: pat.id,
          bidderNumber: 102,
          checkedInAt: new Date(),
          paymentCustomerRef: "demo-cust-102",
          paymentMethodRef: "demo-pm-102",
          status: RegistrationStatus.CHECKED_IN,
        },
      });
      const reg3 = await tx.registration.create({
        data: {
          eventId: event.id,
          constituentId: morgan.id,
          bidderNumber: 103,
          checkedInAt: new Date(),
          paymentCustomerRef: "demo-cust-103",
          paymentMethodRef: "demo-pm-103",
          status: RegistrationStatus.CHECKED_IN,
        },
      });

      // Alex stays registered but not checked in, to demo that state too.
      await tx.registration.create({
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
    },
    { timeout: 20_000 },
  );
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
