import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import {
  calculateDeductibleCents,
  type TransactionLineType,
} from "@/lib/money/deductible";
import {
  requiresQuidProQuoDisclosure,
  requiresWrittenAcknowledgment,
} from "@/lib/money/substantiation";
import { syncTransactionToEtapestry } from "@/lib/etapestry/demo-sync";
import type { Transaction, TransactionMethod } from "@prisma/client";

/**
 * Consolidated checkout — one payment per bidder covering everything they
 * owe (Section 2/6). This is where the deductible engine actually gets
 * used: every line is run through the same tested function from
 * src/lib/money/deductible.ts, never re-implemented here.
 */

export interface CheckoutLineInput {
  lineType: TransactionLineType;
  amountCents: number;
  fmvCents?: number;
  /** Set for AUCTION_WIN lines to link back to the Award being paid for. */
  awardId?: string;
  designation?: string;
}

export interface RunCheckoutInput {
  registrationId: string;
  lines: CheckoutLineInput[];
  method: TransactionMethod;
  actorId: string;
}

export interface CheckoutLineResult extends CheckoutLineInput {
  fmvCents: number;
  deductibleCents: number;
}

export interface CheckoutResult {
  transaction: Transaction;
  lines: CheckoutLineResult[];
  totalAmountCents: number;
  totalDeductibleCents: number;
  quidProQuoDisclosureRequired: boolean;
  writtenAcknowledgmentRequired: boolean;
}

export interface OutstandingAward {
  awardId: string;
  itemNumber: string;
  itemTitle: string;
  amountCents: number;
  fmvCents: number;
}

/** Awards for this bidder that haven't been paid for in a transaction yet. */
export async function getOutstandingAwardsForRegistration(
  registrationId: string,
): Promise<OutstandingAward[]> {
  const awards = await prisma.award.findMany({
    where: {
      registrationId,
      voidedAt: null,
      transactionLines: { none: { voidedAt: null } },
    },
    include: { item: true },
    orderBy: { awardedAt: "asc" },
  });
  return awards.map((a) => ({
    awardId: a.id,
    itemNumber: a.item.itemNumber,
    itemTitle: a.item.title,
    amountCents: a.amountCents,
    fmvCents: a.item.fmvCents ?? 0,
  }));
}

const GOODS_OR_SERVICES_LINE_TYPES: TransactionLineType[] = [
  "AUCTION_WIN",
  "TICKET",
  "SPONSORSHIP",
  "MERCH",
];

export async function runCheckout(input: RunCheckoutInput): Promise<CheckoutResult> {
  if (input.lines.length === 0) {
    throw new Error("Nothing to check out — add at least one line.");
  }

  const computedLines: CheckoutLineResult[] = input.lines.map((line) => {
    const computed = calculateDeductibleCents({
      lineType: line.lineType,
      amountCents: line.amountCents,
      fmvCents: line.fmvCents,
    });
    return { ...line, fmvCents: computed.fmvCents, deductibleCents: computed.deductibleCents };
  });

  const totalAmountCents = computedLines.reduce((sum, l) => sum + l.amountCents, 0);
  const totalDeductibleCents = computedLines.reduce((sum, l) => sum + l.deductibleCents, 0);
  const receivedGoodsOrServices = input.lines.some((l) =>
    GOODS_OR_SERVICES_LINE_TYPES.includes(l.lineType),
  );
  const quidProQuoDisclosureRequired = requiresQuidProQuoDisclosure(
    totalAmountCents,
    receivedGoodsOrServices,
  );
  const writtenAcknowledgmentRequired = requiresWrittenAcknowledgment(totalDeductibleCents);

  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: input.registrationId },
  });

  const transactionId = randomUUID();

  const transaction = await auditedMutation({
    actorId: input.actorId,
    entityType: "Transaction",
    entityId: transactionId,
    action: "checkout",
    before: async () => null,
    mutate: async (tx) => {
      const created = await tx.transaction.create({
        data: {
          id: transactionId,
          registrationId: input.registrationId,
          eventId: registration.eventId,
          totalCents: totalAmountCents,
          processor: "demo",
          processorRef: `demo-charge-${transactionId.slice(0, 8)}`,
          status: "PAID",
          paidAt: new Date(),
          method: input.method,
        },
      });

      for (const line of computedLines) {
        await tx.transactionLine.create({
          data: {
            transactionId: created.id,
            lineType: line.lineType,
            awardId: line.awardId ?? null,
            amountCents: line.amountCents,
            fmvCents: line.fmvCents,
            deductibleCents: line.deductibleCents,
            designation: line.designation,
          },
        });
      }

      return created;
    },
    after: async (_tx, result) => result,
  });

  // Best-effort: queue the eTapestry sync (Section 7) after the money has
  // committed. A sync failure must never roll back or block a completed
  // checkout — it stays visible and replayable from the sync log instead.
  syncTransactionToEtapestry(transaction.id).catch((err) => {
    console.error("eTapestry sync failed for transaction", transaction.id, err);
  });

  return {
    transaction,
    lines: computedLines,
    totalAmountCents,
    totalDeductibleCents,
    quidProQuoDisclosureRequired,
    writtenAcknowledgmentRequired,
  };
}

/** Fetches a completed transaction with everything a receipt needs to render. */
export async function getTransactionForReceipt(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      lines: { where: { voidedAt: null } },
      registration: { include: { constituent: true } },
      event: { include: { organization: true } },
    },
  });
  if (!transaction) return null;

  const receivedGoodsOrServices = transaction.lines.some((l) =>
    GOODS_OR_SERVICES_LINE_TYPES.includes(l.lineType),
  );
  const totalDeductibleCents = transaction.lines.reduce((s, l) => s + l.deductibleCents, 0);

  return {
    transaction,
    quidProQuoDisclosureRequired: requiresQuidProQuoDisclosure(
      transaction.totalCents,
      receivedGoodsOrServices,
    ),
    writtenAcknowledgmentRequired: requiresWrittenAcknowledgment(totalDeductibleCents),
    totalDeductibleCents,
  };
}
