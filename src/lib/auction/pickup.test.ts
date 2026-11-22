import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AwardNotFoundError, listAwardsForPickup, markAwardPickedUp, unmarkAwardPickedUp } from "./pickup";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("pickup tracking", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      const items = await prisma.auctionItem.findMany({ where: { eventId: { in: eventIds } } });
      const itemIds = items.map((i) => i.id);
      await prisma.award.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.auctionItem.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupAward() {
    const org = await prisma.organization.create({ data: { name: `Pickup Test Org ${Date.now()}` } });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: { orgId: org.id, name: "Pickup Test", eventDate: new Date("2027-04-15T00:00:00Z"), taxYear: 2027 },
    });
    const item = await prisma.auctionItem.create({
      data: { eventId: event.id, itemNumber: "P1", title: "Pickup Test Item", itemType: "SILENT", status: "AWARDED" },
    });
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Winner", lastName: "Person" },
    });
    const registration = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 301 },
    });
    const award = await prisma.award.create({
      data: { itemId: item.id, registrationId: registration.id, amountCents: 5_000 },
    });
    return { event, award };
  }

  it("starts unclaimed and can be marked picked up", async () => {
    const { event, award } = await setupAward();

    const rows = await listAwardsForPickup(event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].pickedUpAt).toBeNull();

    const updated = await markAwardPickedUp(award.id, "volunteer");
    expect(updated.pickedUpAt).not.toBeNull();

    const rowsAfter = await listAwardsForPickup(event.id);
    expect(rowsAfter[0].pickedUpAt).not.toBeNull();
  });

  it("can be unmarked back to unclaimed", async () => {
    const { award } = await setupAward();
    await markAwardPickedUp(award.id, "volunteer");
    const undone = await unmarkAwardPickedUp(award.id, "volunteer");
    expect(undone.pickedUpAt).toBeNull();
  });

  it("writes an audit row for the pickup action", async () => {
    const { award } = await setupAward();
    await markAwardPickedUp(award.id, "volunteer");
    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "Award", entityId: award.id, action: "mark_picked_up" },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].actorId).toBe("volunteer");
  });

  it("rejects an unknown award id", async () => {
    await expect(markAwardPickedUp("not-a-real-award-id", "volunteer")).rejects.toThrow(
      AwardNotFoundError,
    );
  });

  it("sorts unclaimed items before picked-up items", async () => {
    const { event, award } = await setupAward();
    const { award: secondAward } = await setupAwardInEvent(event.id);
    await markAwardPickedUp(award.id, "volunteer");

    const rows = await listAwardsForPickup(event.id);
    expect(rows[0].awardId).toBe(secondAward.id); // unclaimed one first
    expect(rows[0].pickedUpAt).toBeNull();
  });

  async function setupAwardInEvent(eventId: string) {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    const item = await prisma.auctionItem.create({
      data: { eventId, itemNumber: "P2", title: "Second Pickup Item", itemType: "SILENT", status: "AWARDED" },
    });
    const constituent = await prisma.constituent.create({
      data: { orgId: event.orgId, firstName: "Second", lastName: "Winner" },
    });
    const registration = await prisma.registration.create({
      data: { eventId, constituentId: constituent.id, bidderNumber: 302 },
    });
    const award = await prisma.award.create({
      data: { itemId: item.id, registrationId: registration.id, amountCents: 6_000 },
    });
    return { award };
  }
});
