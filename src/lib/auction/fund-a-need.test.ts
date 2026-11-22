import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFundANeedTotalCents, listFundANeedGifts, recordFundANeedBatch } from "./fund-a-need";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("fund-a-need clerk batch", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      const transactions = await prisma.transaction.findMany({ where: { eventId: { in: eventIds } } });
      const transactionIds = transactions.map((t) => t.id);
      await prisma.transactionLine.deleteMany({ where: { transactionId: { in: transactionIds } } });
      await prisma.transaction.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupEventWithRegistrations(count: number) {
    const org = await prisma.organization.create({ data: { name: `Fund-a-Need Test Org ${Date.now()}` } });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: { orgId: org.id, name: "Fund-a-Need Test", eventDate: new Date("2027-04-15T00:00:00Z"), taxYear: 2027 },
    });
    const registrations = [];
    for (let i = 0; i < count; i++) {
      const constituent = await prisma.constituent.create({
        data: { orgId: org.id, firstName: `Paddle${i}`, lastName: "Giver" },
      });
      const registration = await prisma.registration.create({
        data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 200 + i, status: "CHECKED_IN" },
      });
      registrations.push(registration);
    }
    return { org, event, registrations };
  }

  it("creates one full-amount-deductible transaction per tapped paddle", async () => {
    const { event, registrations } = await setupEventWithRegistrations(3);
    const results = await recordFundANeedBatch(
      event.id,
      50_000,
      registrations.map((r) => r.id),
      "admin",
    );

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);

    for (const result of results) {
      const transaction = await prisma.transaction.findUniqueOrThrow({
        where: { id: result.transactionId },
        include: { lines: true },
      });
      expect(transaction.status).toBe("PAID");
      expect(transaction.totalCents).toBe(50_000);
      expect(transaction.lines).toHaveLength(1);
      expect(transaction.lines[0].lineType).toBe("FUND_A_NEED");
      expect(transaction.lines[0].deductibleCents).toBe(50_000); // full amount, nothing received in return
    }

    const total = await getFundANeedTotalCents(event.id);
    expect(total).toBe(150_000);

    const gifts = await listFundANeedGifts(event.id);
    expect(gifts).toHaveLength(3);
    expect(gifts.every((g) => g.amountCents === 50_000)).toBe(true);
  });

  it("doesn't let one bad paddle in the batch block the others", async () => {
    const { event, registrations } = await setupEventWithRegistrations(2);
    const results = await recordFundANeedBatch(
      event.id,
      10_000,
      [registrations[0].id, "not-a-real-registration-id"],
      "admin",
    );

    expect(results).toHaveLength(2);
    const good = results.find((r) => r.registrationId === registrations[0].id);
    const bad = results.find((r) => r.registrationId === "not-a-real-registration-id");
    expect(good?.ok).toBe(true);
    expect(bad?.ok).toBe(false);
    expect(bad?.error).toMatch(/no such paddle/i);

    const total = await getFundANeedTotalCents(event.id);
    expect(total).toBe(10_000);
  });

  it("rejects an empty paddle list", async () => {
    const { event } = await setupEventWithRegistrations(0);
    await expect(recordFundANeedBatch(event.id, 10_000, [], "admin")).rejects.toThrow(
      /select at least one paddle/i,
    );
  });
});
