import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runCheckout } from "@/lib/checkout/checkout";
import { FakeEmailAdapter } from "./fake-adapter";
import { setEmailAdapterForTesting } from "./index";

/** runCheckout fires the receipt email in the background (fire-and-forget,
 * same as the eTapestry sync) rather than awaiting it — give that
 * microtask a moment to land before asserting on what the fake adapter
 * recorded. This also exercises the real wiring (checkout -> auto-email),
 * not just send-receipt.ts in isolation. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("sendReceiptEmail", () => {
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
    setEmailAdapterForTesting(undefined);
  });

  async function setupEvent(label: string, donorEmail: string | null) {
    const org = await prisma.organization.create({
      data: { name: `Receipt Email Test Org ${label} ${Date.now()}`, ein: "12-3456789" },
    });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: `Receipt Email Test Event ${label}`,
        eventDate: new Date("2027-04-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    const constituent = await prisma.constituent.create({
      data: { orgId: org.id, firstName: "Donor", lastName: label, email: donorEmail ?? "" },
    });
    const registration = await prisma.registration.create({
      data: { eventId: event.id, constituentId: constituent.id, bidderNumber: 101 },
    });
    return { event, registration };
  }

  it("emails the donor with the disclosure when goods/services exceed $75", async () => {
    const fake = new FakeEmailAdapter();
    setEmailAdapterForTesting(fake);

    const { registration } = await setupEvent("disclosure", "donor@example.com");
    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "AUCTION_WIN", amountCents: 20_000, fmvCents: 15_000 }],
      method: "CARD",
      actorId: "admin",
    });
    await flush();

    expect(fake.sent).toHaveLength(1);
    const email = fake.sent[0];
    expect(email.to).toBe("donor@example.com");
    expect(email.subject).toContain("Receipt Email Test Org disclosure");
    expect(email.html).toContain("Quid pro quo disclosure");
    expect(email.html).toContain("$50.00"); // deductible: 200 - 150
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments?.[0].contentType).toBe("application/pdf");
  });

  it("does not include the disclosure for a pure cash gift", async () => {
    const fake = new FakeEmailAdapter();
    setEmailAdapterForTesting(fake);

    const { registration } = await setupEvent("cash", "cash-donor@example.com");
    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 10_000 }],
      method: "CARD",
      actorId: "admin",
    });
    await flush();

    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].html).not.toContain("Quid pro quo disclosure");
  });

  it("sends nothing when the donor has no email on file", async () => {
    const fake = new FakeEmailAdapter();
    setEmailAdapterForTesting(fake);

    const { registration } = await setupEvent("noemail", null);
    await runCheckout({
      registrationId: registration.id,
      lines: [{ lineType: "CASH_GIFT", amountCents: 5_000 }],
      method: "CASH",
      actorId: "admin",
    });
    await flush();

    expect(fake.sent).toHaveLength(0);
  });
});
