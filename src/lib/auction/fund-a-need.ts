import { prisma } from "@/lib/prisma";
import { assertCents } from "@/lib/money/deductible";
import { runCheckout } from "@/lib/checkout/checkout";

/**
 * Fund-a-need clerk batch (Event night, item 12): the emcee calls out a
 * giving level ("Who'll give $500? ... $250?") and paddles go up across
 * the room all at once. One admin taps every paddle that raised at that
 * level and submits them together — each paddle becomes its own
 * checkout (one FUND_A_NEED line, full amount deductible per
 * src/lib/money/deductible.ts), charged the same way a regular checkout
 * is (src/lib/checkout/checkout.ts: "demo" processor, method CARD by
 * default — the card already on file at registration).
 *
 * Each registration's checkout is independent: one bad id in the batch
 * doesn't roll back or block the others.
 */

export interface FundANeedBatchResult {
  registrationId: string;
  bidderNumber: number | null;
  ok: boolean;
  transactionId?: string;
  error?: string;
}

export async function recordFundANeedBatch(
  eventId: string,
  amountCents: number,
  registrationIds: string[],
  actorId: string,
): Promise<FundANeedBatchResult[]> {
  assertCents(amountCents, "amountCents");
  if (registrationIds.length === 0) {
    throw new Error("Select at least one paddle.");
  }

  const results: FundANeedBatchResult[] = [];
  for (const registrationId of registrationIds) {
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, eventId, voidedAt: null },
    });
    if (!registration) {
      results.push({ registrationId, bidderNumber: null, ok: false, error: "No such paddle in this event." });
      continue;
    }

    try {
      const checkout = await runCheckout({
        registrationId,
        lines: [{ lineType: "FUND_A_NEED", amountCents }],
        method: "CARD",
        actorId,
      });
      results.push({
        registrationId,
        bidderNumber: registration.bidderNumber,
        ok: true,
        transactionId: checkout.transaction.id,
      });
    } catch (err) {
      results.push({
        registrationId,
        bidderNumber: registration.bidderNumber,
        ok: false,
        error: err instanceof Error ? err.message : "Checkout failed.",
      });
    }
  }

  return results;
}

export interface FundANeedTransactionSummary {
  transactionId: string;
  bidderNumber: number;
  donorName: string;
  amountCents: number;
  createdAt: Date;
}

/** All fund-a-need gifts recorded for this event so far — newest first. */
export async function listFundANeedGifts(eventId: string): Promise<FundANeedTransactionSummary[]> {
  const lines = await prisma.transactionLine.findMany({
    where: {
      lineType: "FUND_A_NEED",
      voidedAt: null,
      transaction: { eventId, voidedAt: null },
    },
    include: {
      transaction: {
        include: { registration: { include: { constituent: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return lines.map((line) => {
    const registration = line.transaction.registration;
    const constituent = registration.constituent;
    const donorName = constituent.isBusiness
      ? (constituent.orgName ?? "")
      : `${constituent.firstName ?? ""} ${constituent.lastName ?? ""}`.trim();
    return {
      transactionId: line.transaction.id,
      bidderNumber: registration.bidderNumber,
      donorName,
      amountCents: line.amountCents,
      createdAt: line.createdAt,
    };
  });
}

export async function getFundANeedTotalCents(eventId: string): Promise<number> {
  const result = await prisma.transactionLine.aggregate({
    where: {
      lineType: "FUND_A_NEED",
      voidedAt: null,
      transaction: { eventId, voidedAt: null },
    },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}
