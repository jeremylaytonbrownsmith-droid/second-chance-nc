import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runCheckout } from "@/lib/checkout/checkout";
import { getDonorYearEndStatement, listDonorYearEndStatementsForOrg } from "./year-end";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("year-end statements", () => {
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

  async function setupOrgWithTwoEventsSameYear() {
    const org = await prisma.organization.create({
      data: { name: `Statement Test Org ${Date.now()}`, ein: "98-7654321" },
    });
    createdOrgIds.push(org.id);
    const eventA = await prisma.event.create({
      data: {
        orgId: org.id,
        name: "Spring Gala",
        eventDate: new Date("2027-04-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    const eventB = await prisma.event.create({
      data: {
        orgId: org.id,
        name: "Fall Gala",
        eventDate: new Date("2027-10-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Multi", lastName: "Giver", email: "multi@example.com" },
    });
    const regA = await prisma.registration.create({
      data: { eventId: eventA.id, constituentId: constituent.id, bidderNumber: 201 },
    });
    const regB = await prisma.registration.create({
      data: { eventId: eventB.id, constituentId: constituent.id, bidderNumber: 301 },
    });
    return { org, constituent, regA, regB };
  }

  it("combines giving across multiple events in the same org and tax year", async () => {
    const { org, constituent, regA, regB } = await setupOrgWithTwoEventsSameYear();

    await runCheckout({
      registrationId: regA.id,
      lines: [{ lineType: "AUCTION_WIN", amountCents: 30_000, fmvCents: 20_000 }],
      method: "CARD",
      actorId: "admin",
    });
    await runCheckout({
      registrationId: regB.id,
      lines: [
        { lineType: "CASH_GIFT", amountCents: 5_000 },
        { lineType: "FUND_A_NEED", amountCents: 2_500 },
      ],
      method: "CASH",
      actorId: "admin",
    });

    const statement = await getDonorYearEndStatement(org.id, constituent.id, 2027);
    expect(statement).not.toBeNull();
    expect(statement!.totalAmountCents).toBe(30_000 + 5_000 + 2_500);
    // Auction deductible = 30000 - 20000 = 10000; cash + fund-a-need are fully deductible.
    expect(statement!.totalDeductibleCents).toBe(10_000 + 5_000 + 2_500);
    expect(statement!.byLineType.AUCTION_WIN.amountCents).toBe(30_000);
    expect(statement!.byLineType.AUCTION_WIN.deductibleCents).toBe(10_000);
    expect(statement!.byLineType.CASH_GIFT.amountCents).toBe(5_000);
    expect(statement!.byLineType.FUND_A_NEED.amountCents).toBe(2_500);
  });

  it("excludes a different tax year", async () => {
    const { org, constituent } = await setupOrgWithTwoEventsSameYear();
    const statement = await getDonorYearEndStatement(org.id, constituent.id, 1999);
    expect(statement).toBeNull();
  });

  it("lists every donor with giving that org/year, sorted by deductible total", async () => {
    const { org, regA, regB } = await setupOrgWithTwoEventsSameYear();
    await runCheckout({
      registrationId: regA.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 1_000 }],
      method: "CASH",
      actorId: "admin",
    });
    await runCheckout({
      registrationId: regB.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 9_000 }],
      method: "CASH",
      actorId: "admin",
    });

    const statements = await listDonorYearEndStatementsForOrg(org.id, 2027);
    expect(statements).toHaveLength(1); // same constituent both registrations
    expect(statements[0].totalAmountCents).toBe(10_000);
  });
});
