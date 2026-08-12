/**
 * Rule helpers from the Section 5 table that aren't the deductible split
 * itself: quid pro quo disclosure, the written acknowledgment threshold,
 * item donor 8283 substantiation, and the 8282 filing tripwire.
 *
 * Pure functions only — no I/O, no Date.now(). Callers pass in the dates
 * they care about so these stay deterministic and testable.
 *
 * These dollar thresholds are the general federal rules as commonly
 * applied. See CLAUDE.md: none of this ships without the organization's
 * accountant signing off in writing.
 */

import { assertCents } from "./deductible";

/** Quid pro quo disclosure triggers above $75, per transaction. */
export const QUID_PRO_QUO_THRESHOLD_CENTS = 7_500;

/** Contributions at or above $250 require a written acknowledgment. */
export const WRITTEN_ACKNOWLEDGMENT_THRESHOLD_CENTS = 25_000;

/** Item donor claimed values above $500 need Form 8283. */
export const FORM_8283_THRESHOLD_CENTS = 50_000;

/** Item donor claimed values above $5,000 need the org to sign Part IV. */
export const FORM_8283_PART_IV_THRESHOLD_CENTS = 500_000;

/** Form 8282 is generally due within 125 days of the sale. */
export const FORM_8282_DUE_DAYS = 125;

/**
 * Rule 2: quid pro quo disclosure. Trigger per transaction (the total the
 * donor paid across every line), not per line, when they received goods or
 * services in return and the total exceeds the threshold.
 */
export function requiresQuidProQuoDisclosure(
  transactionTotalCents: number,
  receivedGoodsOrServices: boolean,
): boolean {
  assertCents(transactionTotalCents, "transactionTotalCents");
  return (
    receivedGoodsOrServices &&
    transactionTotalCents > QUID_PRO_QUO_THRESHOLD_CENTS
  );
}

/**
 * Rule 3: contributions of $250 or more require a contemporaneous written
 * acknowledgment stating whether goods or services were provided.
 */
export function requiresWrittenAcknowledgment(
  contributionAmountCents: number,
): boolean {
  assertCents(contributionAmountCents, "contributionAmountCents");
  return contributionAmountCents >= WRITTEN_ACKNOWLEDGMENT_THRESHOLD_CENTS;
}

export interface ItemDonorSubstantiation {
  /** True once claimedValueCents exceeds $500 — Form 8283 is needed. */
  substantiationNeeded: boolean;
  /** True once claimedValueCents exceeds $5,000 — org signs Part IV. */
  requiresPartIVSignature: boolean;
}

/**
 * Rule 4: item donor substantiation. Claims over $500 need Form 8283.
 * Claims over $5,000 additionally need the organization to sign Part IV.
 */
export function evaluateItemDonorSubstantiation(
  claimedValueCents: number,
): ItemDonorSubstantiation {
  assertCents(claimedValueCents, "claimedValueCents");
  return {
    substantiationNeeded: claimedValueCents > FORM_8283_THRESHOLD_CENTS,
    requiresPartIVSignature:
      claimedValueCents > FORM_8283_PART_IV_THRESHOLD_CENTS,
  };
}

/**
 * Rule 5: the 8282 tripwire. When an item that came in on an 8283 over
 * $5,000 sells, Form 8282 is generally due within 125 days of the sale.
 * Returns null when the claimed value doesn't cross the Part IV threshold —
 * no 8282 obligation, no task to create.
 */
export function calculateForm8282DueDate(
  saleDate: Date,
  claimedValueCents: number,
): Date | null {
  assertCents(claimedValueCents, "claimedValueCents");
  if (claimedValueCents <= FORM_8283_PART_IV_THRESHOLD_CENTS) {
    return null;
  }
  const dueDate = new Date(saleDate.getTime());
  dueDate.setUTCDate(dueDate.getUTCDate() + FORM_8282_DUE_DAYS);
  return dueDate;
}

export class ItemNotReadyToOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotReadyToOpenError";
  }
}

/**
 * Rule 1: FMV is required on every auction item before it can open for
 * bidding. Call this from the status-transition validation in the admin
 * CRUD layer, not just at the UI.
 */
export function assertItemCanOpenForBidding(item: {
  fmvCents: number | null | undefined;
}): void {
  if (item.fmvCents === null || item.fmvCents === undefined) {
    throw new ItemNotReadyToOpenError(
      "Fair market value must be set before this item can open for bidding.",
    );
  }
  assertCents(item.fmvCents, "fmvCents");
}
