import { prisma } from "@/lib/prisma";
import type { CsvColumn } from "@/lib/csv/to-csv";
import { TRANSACTION_LINE_TYPES, type TransactionLineType } from "@/lib/money/deductible";

/**
 * Year-end donor statement: everything one constituent gave under one
 * organization in one tax year, combined — auction wins (deductible
 * portion only), cash gifts, fund-a-need, and every other line type —
 * into one total. The deductible math itself isn't computed here; every
 * TransactionLine.deductibleCents was already computed once, at checkout
 * time, by src/lib/money/deductible.ts (never re-derived or re-guessed).
 * This module only sums rows that already exist.
 *
 * Scoped to (orgId, taxYear), not eventId — an organization can run more
 * than one event in a tax year, and a donor's statement is organization-
 * and tax-year-scoped, not event-scoped.
 */

export interface LineTypeTotal {
  amountCents: number;
  deductibleCents: number;
}

export interface DonorYearEndStatement {
  constituentId: string;
  donorName: string;
  donorEmail: string | null;
  isBusiness: boolean;
  taxYear: number;
  orgName: string;
  orgEin: string | null;
  byLineType: Record<TransactionLineType, LineTypeTotal>;
  totalAmountCents: number;
  totalDeductibleCents: number;
}

function emptyTotals(): Record<TransactionLineType, LineTypeTotal> {
  return Object.fromEntries(
    TRANSACTION_LINE_TYPES.map((t) => [t, { amountCents: 0, deductibleCents: 0 }]),
  ) as Record<TransactionLineType, LineTypeTotal>;
}

function constituentDisplayName(c: { isBusiness: boolean; orgName: string | null; firstName: string | null; lastName: string | null }): string {
  return c.isBusiness ? (c.orgName ?? "") : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

/** Every (orgId, taxYear) pair that has at least one paid transaction —
 * drives the bulk list/export so staff don't have to already know which
 * donors gave before generating statements for "everyone." */
export async function listDonorYearEndStatementsForOrg(
  orgId: string,
  taxYear: number,
): Promise<DonorYearEndStatement[]> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

  const lines = await prisma.transactionLine.findMany({
    where: {
      voidedAt: null,
      transaction: {
        status: "PAID",
        voidedAt: null,
        event: { orgId, taxYear },
      },
    },
    include: {
      transaction: {
        include: { registration: { include: { constituent: true } } },
      },
    },
  });

  const byConstituent = new Map<string, DonorYearEndStatement>();
  for (const line of lines) {
    const constituent = line.transaction.registration.constituent;
    let statement = byConstituent.get(constituent.id);
    if (!statement) {
      statement = {
        constituentId: constituent.id,
        donorName: constituentDisplayName(constituent),
        donorEmail: constituent.email,
        isBusiness: constituent.isBusiness,
        taxYear,
        orgName: org.name,
        orgEin: org.ein,
        byLineType: emptyTotals(),
        totalAmountCents: 0,
        totalDeductibleCents: 0,
      };
      byConstituent.set(constituent.id, statement);
    }
    const bucket = statement.byLineType[line.lineType as TransactionLineType];
    bucket.amountCents += line.amountCents;
    bucket.deductibleCents += line.deductibleCents;
    statement.totalAmountCents += line.amountCents;
    statement.totalDeductibleCents += line.deductibleCents;
  }

  return Array.from(byConstituent.values()).sort((a, b) => b.totalDeductibleCents - a.totalDeductibleCents);
}

/** One donor's statement, or null if they gave nothing that org/tax year. */
export async function getDonorYearEndStatement(
  orgId: string,
  constituentId: string,
  taxYear: number,
): Promise<DonorYearEndStatement | null> {
  const all = await listDonorYearEndStatementsForOrg(orgId, taxYear);
  return all.find((s) => s.constituentId === constituentId) ?? null;
}

export const LINE_TYPE_LABELS: Record<TransactionLineType, string> = {
  AUCTION_WIN: "Auction purchases",
  RAFFLE: "Raffle tickets",
  FUND_A_NEED: "Fund a need",
  CASH_GIFT: "Cash gifts",
  TICKET: "Event tickets",
  SPONSORSHIP: "Sponsorships",
  MERCH: "Merchandise",
};

export const donorYearEndStatementCsvColumns: CsvColumn<DonorYearEndStatement>[] = [
  { header: "Donor", value: (s) => s.donorName },
  { header: "Email", value: (s) => s.donorEmail },
  { header: "Tax year", value: (s) => s.taxYear },
  ...TRANSACTION_LINE_TYPES.flatMap((type): CsvColumn<DonorYearEndStatement>[] => [
    { header: `${LINE_TYPE_LABELS[type]} paid`, value: (s) => (s.byLineType[type].amountCents / 100).toFixed(2) },
    {
      header: `${LINE_TYPE_LABELS[type]} deductible`,
      value: (s) => (s.byLineType[type].deductibleCents / 100).toFixed(2),
    },
  ]),
  { header: "Total paid", value: (s) => (s.totalAmountCents / 100).toFixed(2) },
  { header: "Total deductible", value: (s) => (s.totalDeductibleCents / 100).toFixed(2) },
];
