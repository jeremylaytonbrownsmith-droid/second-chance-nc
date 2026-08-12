/**
 * The deductible calculation. This is the heart of the system — see
 * CLAUDE.md ("The deductible calculation") for the table this implements
 * and the accountant sign-off requirement that governs any change here.
 *
 * Pure functions only. No I/O, no Prisma, no Date.now(). Every money value
 * is an integer number of cents.
 */

export const TRANSACTION_LINE_TYPES = [
  "AUCTION_WIN",
  "RAFFLE",
  "FUND_A_NEED",
  "CASH_GIFT",
  "TICKET",
  "SPONSORSHIP",
  "MERCH",
] as const;

export type TransactionLineType = (typeof TRANSACTION_LINE_TYPES)[number];

export class InvalidMoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyInputError";
  }
}

/** Throws unless `value` is a non-negative integer number of cents. */
export function assertCents(value: number, fieldName: string): void {
  if (!Number.isInteger(value)) {
    throw new InvalidMoneyInputError(
      `${fieldName} must be an integer number of cents, got ${value}`,
    );
  }
  if (value < 0) {
    throw new InvalidMoneyInputError(
      `${fieldName} must not be negative, got ${value}`,
    );
  }
}

export interface DeductibleLineInput {
  lineType: TransactionLineType;
  /** What the donor paid, in cents. */
  amountCents: number;
  /** Fair market value of goods or services received, in cents. Ignored for
   * line types that don't reference an FMV (RAFFLE, FUND_A_NEED, CASH_GIFT),
   * but still validated if provided. */
  fmvCents?: number;
}

export interface DeductibleLineResult extends DeductibleLineInput {
  fmvCents: number;
  deductibleCents: number;
}

/**
 * Computes the deductible amount for a single transaction line per the
 * Section 5 table. Never returns a negative number (rule 6, zero and
 * negative guard).
 */
export function calculateDeductibleCents(
  input: DeductibleLineInput,
): DeductibleLineResult {
  const fmvCents = input.fmvCents ?? 0;
  assertCents(input.amountCents, "amountCents");
  assertCents(fmvCents, "fmvCents");

  let deductibleCents: number;
  switch (input.lineType) {
    case "AUCTION_WIN":
    case "TICKET":
    case "SPONSORSHIP":
    case "MERCH":
      // max(0, amount - fmv). For MERCH this is "zero unless priced above
      // FMV, then the excess" — same formula.
      deductibleCents = Math.max(0, input.amountCents - fmvCents);
      break;
    case "RAFFLE":
      // Raffle ticket purchases are not charitable contributions.
      deductibleCents = 0;
      break;
    case "FUND_A_NEED":
    case "CASH_GIFT":
      // Nothing received in return — the full amount is deductible.
      deductibleCents = input.amountCents;
      break;
    default: {
      const exhaustiveCheck: never = input.lineType;
      throw new InvalidMoneyInputError(
        `Unknown transaction line type: ${String(exhaustiveCheck)}`,
      );
    }
  }

  return { ...input, fmvCents, deductibleCents };
}

export interface TransactionDeductibleSummary {
  lines: DeductibleLineResult[];
  totalAmountCents: number;
  totalFmvCents: number;
  totalDeductibleCents: number;
}

/**
 * Computes the deductible split for every line in a transaction and rolls
 * up the totals. Used for checkout math and for the year-end statement
 * aggregation (Section 5, "Year end statement").
 */
export function calculateTransactionDeductibleCents(
  lines: DeductibleLineInput[],
): TransactionDeductibleSummary {
  const results = lines.map(calculateDeductibleCents);
  return {
    lines: results,
    totalAmountCents: results.reduce((sum, l) => sum + l.amountCents, 0),
    totalFmvCents: results.reduce((sum, l) => sum + l.fmvCents, 0),
    totalDeductibleCents: results.reduce(
      (sum, l) => sum + l.deductibleCents,
      0,
    ),
  };
}
