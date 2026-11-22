import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AlreadyCheckedInError, checkInConstituent, checkInWalkIn } from "./checkin";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("checkInConstituent / checkInWalkIn", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupEvent() {
    const org = await prisma.organization.create({ data: { name: `Checkin Test Org ${Date.now()}` } });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: { orgId: org.id, name: "Checkin Test Event", eventDate: new Date("2027-04-15T00:00:00Z"), taxYear: 2027 },
    });
    return { org, event };
  }

  it("assigns paddle #101 to the first check-in on a fresh event", async () => {
    const { event } = await setupEvent();
    const reg = await checkInWalkIn(event.orgId, event.id, { firstName: "First", lastName: "Walkin" }, "volunteer");
    expect(reg.bidderNumber).toBe(101);
    expect(reg.status).toBe("CHECKED_IN");
    expect(reg.checkedInAt).not.toBeNull();
  });

  it("assigns sequential paddle numbers to successive walk-ins", async () => {
    const { event } = await setupEvent();
    const reg1 = await checkInWalkIn(event.orgId, event.id, { firstName: "A", lastName: "One" }, "volunteer");
    const reg2 = await checkInWalkIn(event.orgId, event.id, { firstName: "B", lastName: "Two" }, "volunteer");
    expect(reg2.bidderNumber).toBe(reg1.bidderNumber + 1);
  });

  it("checks in a pre-existing constituent who has no registration yet", async () => {
    const { org, event } = await setupEvent();
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Preloaded", lastName: "Donor", email: "preloaded@example.com" },
    });
    const reg = await checkInConstituent(event.id, constituent.id, "volunteer");
    expect(reg.constituentId).toBe(constituent.id);
    expect(reg.status).toBe("CHECKED_IN");
  });

  it("marks an already-registered-but-not-checked-in bidder checked in without reassigning their paddle", async () => {
    const { org, event } = await setupEvent();
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Pre", lastName: "Registered" },
    });
    const existing = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 500 },
    });
    expect(existing.checkedInAt).toBeNull();

    const reg = await checkInConstituent(event.id, constituent.id, "volunteer");
    expect(reg.id).toBe(existing.id);
    expect(reg.bidderNumber).toBe(500); // unchanged
    expect(reg.checkedInAt).not.toBeNull();
  });

  it("refuses to check in the same constituent twice", async () => {
    const { org, event } = await setupEvent();
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Twice", lastName: "Checker" },
    });
    await checkInConstituent(event.id, constituent.id, "volunteer");
    await expect(checkInConstituent(event.id, constituent.id, "volunteer")).rejects.toThrow(
      AlreadyCheckedInError,
    );
  });
});
