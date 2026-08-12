import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrganization } from "./organizations";
import { createEvent } from "./events";
import { createConstituent } from "./constituents";
import { createItemDonor } from "./item-donors";
import {
  closeAuctionItem,
  createAuctionItem,
  openAuctionItemForBidding,
  updateAuctionItemFmv,
} from "./auction-items";
import { ItemNotReadyToOpenError } from "@/lib/money/substantiation";
import { toCsv } from "@/lib/csv/to-csv";
import { organizationCsvColumns } from "./organizations";

/**
 * Exercises the admin service layer against a real Postgres database
 * (see prisma/migrations) rather than mocking Prisma — the FMV gate and
 * audit-row writes are exactly the kind of thing that look right in a
 * mock and fail against a real transaction. Skips gracefully if no
 * database is reachable so `npm test` still works in environments without
 * one; CI for this repo should provision Postgres so this suite runs.
 */

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("admin CRUD integration", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      await prisma.auctionItem.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.itemDonor.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupOrgAndEvent(label: string) {
    const org = await createOrganization({
      name: `Test Org ${label} ${Date.now()}`,
      fiscalYearStart: 1,
    });
    createdOrgIds.push(org.id);
    const event = await createEvent({
      orgId: org.id,
      name: `Test Gala ${label}`,
      eventDate: new Date("2027-04-15T00:00:00Z"),
      taxYear: 2027,
    });
    return { org, event };
  }

  it("creates an organization and event", async () => {
    const { org, event } = await setupOrgAndEvent("basic");
    expect(org.id).toBeTruthy();
    expect(event.orgId).toBe(org.id);
    expect(event.status).toBe("DRAFT");
  });

  it("requires a name for individual constituents and orgName for business ones", async () => {
    const { org } = await setupOrgAndEvent("constituents");
    await expect(
      createConstituent({ orgId: org.id, isBusiness: false }),
    ).rejects.toThrow();
    await expect(
      createConstituent({ orgId: org.id, isBusiness: true }),
    ).rejects.toThrow();

    const individual = await createConstituent({
      orgId: org.id,
      isBusiness: false,
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie@example.com",
    });
    expect(individual.firstName).toBe("Jamie");

    const business = await createConstituent({
      orgId: org.id,
      isBusiness: true,
      orgName: "Acme Vet Supply",
    });
    expect(business.orgName).toBe("Acme Vet Supply");
  });

  it("flags item donor substantiation above $500 and writes an audit row", async () => {
    const { org, event } = await setupOrgAndEvent("item-donor");
    const constituent = await createConstituent({
      orgId: org.id,
      isBusiness: false,
      firstName: "Pat",
      lastName: "Nguyen",
    });

    const lowValue = await createItemDonor(
      { eventId: event.id, constituentId: constituent.id, claimedValueCents: 10_000 },
      "test-actor",
    );
    expect(lowValue.substantiationNeeded).toBe(false);

    const highValue = await createItemDonor(
      { eventId: event.id, constituentId: constituent.id, claimedValueCents: 60_000 },
      "test-actor",
    );
    expect(highValue.substantiationNeeded).toBe(true);

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: "ItemDonor", entityId: highValue.id, action: "create" },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorId).toBe("test-actor");
  });

  it("blocks opening an auction item for bidding until FMV is set, then allows it", async () => {
    const { event } = await setupOrgAndEvent("auction-item");
    const item = await createAuctionItem({
      eventId: event.id,
      itemNumber: "A1",
      title: "Weekend at the lake house",
      itemType: "SILENT",
    });
    expect(item.status).toBe("DRAFT");
    expect(item.fmvCents).toBeNull();

    await expect(openAuctionItemForBidding(item.id, "test-actor")).rejects.toThrow(
      ItemNotReadyToOpenError,
    );

    const withFmv = await updateAuctionItemFmv(
      item.id,
      50_000,
      "Comparable weekend rental listings",
      "test-actor",
    );
    expect(withFmv.fmvCents).toBe(50_000);

    const opened = await openAuctionItemForBidding(item.id, "test-actor");
    expect(opened.status).toBe("OPEN");

    const closed = await closeAuctionItem(item.id, "test-actor");
    expect(closed.status).toBe("CLOSED");

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "AuctionItem", entityId: item.id },
      orderBy: { createdAt: "asc" },
    });
    expect(auditRows.map((r) => r.action)).toEqual([
      "update_fmv",
      "open",
      "close",
    ]);
  });

  it("rejects a duplicate item number within the same event", async () => {
    const { event } = await setupOrgAndEvent("dup-item-number");
    await createAuctionItem({
      eventId: event.id,
      itemNumber: "A1",
      title: "First item",
      itemType: "SILENT",
    });
    await expect(
      createAuctionItem({
        eventId: event.id,
        itemNumber: "A1",
        title: "Duplicate number",
        itemType: "SILENT",
      }),
    ).rejects.toThrow();
  });

  it("exports organizations to CSV via the shared column definitions", async () => {
    const { org } = await setupOrgAndEvent("csv-export");
    const csv = toCsv([org], organizationCsvColumns);
    expect(csv).toContain(org.id);
    expect(csv).toContain(org.name);
  });
});
