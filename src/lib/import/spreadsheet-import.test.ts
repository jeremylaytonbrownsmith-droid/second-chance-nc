import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  importSpreadsheetRows,
  normalizeRow,
  type RawRow,
} from "./spreadsheet-import";

describe("normalizeRow", () => {
  function row(values: Record<string, string>): RawRow {
    return { rowNumber: 2, values };
  }

  it("accepts the canonical header names", () => {
    const result = normalizeRow(
      row({
        "Donor Name": "Jamie Rivera",
        "Donor Email": "jamie@example.com",
        "Line Type": "Auction Win",
        Amount: "300",
        FMV: "200",
        Designation: "General",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.row).toMatchObject({
      donorName: "Jamie Rivera",
      donorEmail: "jamie@example.com",
      lineType: "AUCTION_WIN",
      amountCents: 30_000,
      fmvCents: 20_000,
      designation: "General",
    });
  });

  it("accepts alternate header spellings", () => {
    const result = normalizeRow(
      row({ Name: "Pat Nguyen", Email: "pat@example.com", Type: "cash", "Amount Paid": "50" }),
    );
    expect(result.ok).toBe(true);
    expect(result.row?.lineType).toBe("CASH_GIFT");
    expect(result.row?.amountCents).toBe(5_000);
  });

  it("maps friendly line type labels to enum values", () => {
    const cases: [string, string][] = [
      ["auction win", "AUCTION_WIN"],
      ["Auction", "AUCTION_WIN"],
      ["RAFFLE", "RAFFLE"],
      ["fund a need", "FUND_A_NEED"],
      ["Fund-a-Need", "FUND_A_NEED"],
      ["cash", "CASH_GIFT"],
      ["Cash Gift", "CASH_GIFT"],
      ["ticket", "TICKET"],
      ["sponsorship", "SPONSORSHIP"],
      ["merch", "MERCH"],
      ["Merchandise", "MERCH"],
    ];
    for (const [input, expected] of cases) {
      const result = normalizeRow(row({ Name: "X", Type: input, Amount: "10" }));
      expect(result.ok, `expected "${input}" to parse`).toBe(true);
      expect(result.row?.lineType).toBe(expected);
    }
  });

  it("accepts the raw enum spelling directly, case-insensitively", () => {
    const result = normalizeRow(row({ Name: "X", Type: "fund_a_need", Amount: "10" }));
    expect(result.ok).toBe(true);
    expect(result.row?.lineType).toBe("FUND_A_NEED");
  });

  it("strips $ and commas from amounts", () => {
    const result = normalizeRow(row({ Name: "X", Type: "cash", Amount: "$1,250.00" }));
    expect(result.ok).toBe(true);
    expect(result.row?.amountCents).toBe(125_000);
  });

  it("rejects a row with no donor name or email", () => {
    const result = normalizeRow(row({ Type: "cash", Amount: "10" }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/donor/i);
  });

  it("rejects a row with an unrecognized line type", () => {
    const result = normalizeRow(row({ Name: "X", Type: "mystery box", Amount: "10" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a row with a missing or non-positive amount", () => {
    const result = normalizeRow(row({ Name: "X", Type: "cash", Amount: "0" }));
    expect(result.ok).toBe(false);
  });
});

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("importSpreadsheetRows", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (!dbAvailable) return;
    for (const orgId of createdOrgIds) {
      const events = await prisma.event.findMany({ where: { orgId } });
      const eventIds = events.map((e) => e.id);
      await prisma.transactionLine.deleteMany({
        where: { transaction: { eventId: { in: eventIds } } },
      });
      await prisma.transaction.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.registration.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.constituent.deleteMany({ where: { orgId } });
      await prisma.event.deleteMany({ where: { orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    }
  });

  async function setupOrgAndEvent(label: string) {
    const org = await prisma.organization.create({
      data: { name: `Import Test Org ${label} ${Date.now()}` },
    });
    createdOrgIds.push(org.id);
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: `Import Test Event ${label}`,
        eventDate: new Date("2027-04-15T00:00:00Z"),
        taxYear: 2027,
      },
    });
    return { org, event };
  }

  it("imports rows, computes deductible totals, and dedupes a repeat donor by email", async () => {
    const { org, event } = await setupOrgAndEvent("basic");
    const rows: RawRow[] = [
      {
        rowNumber: 2,
        values: {
          "Donor Name": "Taylor Brooks",
          "Donor Email": "taylor.import.test@example.com",
          "Line Type": "Auction Win",
          Amount: "300",
          FMV: "200",
        },
      },
      {
        rowNumber: 3,
        values: {
          "Donor Name": "Taylor Brooks",
          "Donor Email": "taylor.import.test@example.com",
          "Line Type": "Cash Gift",
          Amount: "25",
        },
      },
    ];

    const summary = await importSpreadsheetRows(rows, {
      orgId: org.id,
      eventId: event.id,
      actorId: "test-importer",
    });

    expect(summary.importedRows).toBe(2);
    expect(summary.skippedRows).toBe(0);
    expect(summary.donorsCreated).toBe(1);
    expect(summary.totalAmountCents).toBe(32_500);
    expect(summary.totalDeductibleCents).toBe(10_000 + 2_500); // (300-200) + 25

    const constituents = await prisma.constituent.findMany({
      where: { orgId: org.id, email: "taylor.import.test@example.com" },
    });
    expect(constituents).toHaveLength(1);
  });

  it("reports a per-row error and continues past a bad row rather than aborting the batch", async () => {
    const { org, event } = await setupOrgAndEvent("partial-failure");
    const rows: RawRow[] = [
      { rowNumber: 2, values: { Name: "Good Row", Type: "cash", Amount: "10" } },
      { rowNumber: 3, values: { Type: "cash", Amount: "10" } }, // no donor identity
      { rowNumber: 4, values: { Name: "Also Good", Type: "cash", Amount: "5" } },
    ];

    const summary = await importSpreadsheetRows(rows, {
      orgId: org.id,
      eventId: event.id,
      actorId: "test-importer",
    });

    expect(summary.totalRows).toBe(3);
    expect(summary.importedRows).toBe(2);
    expect(summary.skippedRows).toBe(1);
    expect(summary.outcomes.find((o) => o.rowNumber === 3)?.ok).toBe(false);
  });
});
