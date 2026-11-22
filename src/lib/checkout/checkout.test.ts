import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getTotalRaisedCents, PaymentDeclinedError, runCheckout } from "./checkout";
import { FakePaymentProcessor, setPaymentProcessorForTesting } from "@/lib/payments";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("getTotalRaisedCents", () => {
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

  async function setupEvent(label: string) {
    const org = await prisma.organization.create({
      data: { name: `Checkout Test Org ${label} ${Date.now()}` },
    });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: `Checkout Test Event ${label}`,
        eventDate: new Date("2027-04-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Donor", lastName: label },
    });
    const registration = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 101 },
    });
    return { event, registration };
  }

  it("is zero for an event with no transactions", async () => {
    const { event } = await setupEvent("empty");
    expect(await getTotalRaisedCents(event.id)).toBe(0);
  });

  it("sums every paid transaction for the event", async () => {
    const { event, registration } = await setupEvent("sum");

    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 5_000 }],
      method: "CARD",
      actorId: "test",
    });
    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 2_500 }],
      method: "CARD",
      actorId: "test",
    });

    expect(await getTotalRaisedCents(event.id)).toBe(7_500);
  });

  it("never counts another event's transactions", async () => {
    const { event: eventA, registration: regA } = await setupEvent("isolation-a");
    const { event: eventB } = await setupEvent("isolation-b");

    await runCheckout({
      registrationId: regA.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 10_000 }],
      method: "CARD",
      actorId: "test",
    });

    expect(await getTotalRaisedCents(eventA.id)).toBe(10_000);
    expect(await getTotalRaisedCents(eventB.id)).toBe(0);
  });
});

describe.skipIf(!dbAvailable)("runCheckout — payment processor integration", () => {
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

  afterEach(() => {
    setPaymentProcessorForTesting(undefined);
  });

  async function setupEvent(label: string) {
    const org = await prisma.organization.create({
      data: { name: `Checkout Processor Test Org ${label} ${Date.now()}` },
    });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: `Checkout Processor Test Event ${label}`,
        eventDate: new Date("2027-04-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Donor", lastName: label },
    });
    const registration = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 101 },
    });
    return { event, registration };
  }

  it("a declined card leaves no transaction behind", async () => {
    const { registration } = await setupEvent("declined");
    const decliningProcessor = {
      name: "test-decline",
      charge: async () => ({ ok: false as const, declineReason: "Card declined for testing." }),
    };
    setPaymentProcessorForTesting(decliningProcessor);

    await expect(
      runCheckout({
        registrationId: registration.id,
        lines: [{ lineType: "CASH_GIFT", amountCents: 5_000 }],
        method: "CARD",
        actorId: "test",
      }),
    ).rejects.toThrow(PaymentDeclinedError);

    const transactions = await prisma.transaction.findMany({
      where: { registrationId: registration.id },
    });
    expect(transactions).toHaveLength(0);
  });

  it("CASH and CHECK never call the payment processor at all", async () => {
    const { registration } = await setupEvent("cash-check");
    const fake = new FakePaymentProcessor();
    setPaymentProcessorForTesting(fake);

    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 2_000 }],
      method: "CASH",
      actorId: "test",
    });
    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 3_000 }],
      method: "CHECK",
      actorId: "test",
    });

    expect(fake.charges).toHaveLength(0);

    const transactions = await prisma.transaction.findMany({
      where: { registrationId: registration.id },
      orderBy: { createdAt: "asc" },
    });
    expect(transactions.map((t) => t.processor)).toEqual(["cash", "check"]);
  });

  it("a successful card charge records the processor's reference", async () => {
    const { registration } = await setupEvent("success");
    const fake = new FakePaymentProcessor();
    setPaymentProcessorForTesting(fake);

    const result = await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 4_000 }],
      method: "CARD",
      actorId: "test",
    });

    expect(fake.charges).toHaveLength(1);
    expect(fake.charges[0].amountCents).toBe(4_000);
    expect(fake.charges[0].idempotencyKey).toBe(result.transaction.id);

    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: result.transaction.id },
    });
    expect(transaction.processorRef).toMatch(/^demo-charge-/);
  });
});
