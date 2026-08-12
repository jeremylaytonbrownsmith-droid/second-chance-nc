import { describe, expect, it } from "vitest";
import {
  assertCents,
  calculateDeductibleCents,
  calculateTransactionDeductibleCents,
  InvalidMoneyInputError,
  TRANSACTION_LINE_TYPES,
} from "./deductible";

describe("assertCents", () => {
  it("accepts zero and positive integers", () => {
    expect(() => assertCents(0, "x")).not.toThrow();
    expect(() => assertCents(12345, "x")).not.toThrow();
  });

  it("rejects non-integers", () => {
    expect(() => assertCents(10.5, "amountCents")).toThrow(
      InvalidMoneyInputError,
    );
  });

  it("rejects negative values", () => {
    expect(() => assertCents(-1, "amountCents")).toThrow(
      InvalidMoneyInputError,
    );
  });

  it("rejects NaN and non-finite values", () => {
    expect(() => assertCents(NaN, "amountCents")).toThrow(
      InvalidMoneyInputError,
    );
    expect(() => assertCents(Infinity, "amountCents")).toThrow(
      InvalidMoneyInputError,
    );
  });
});

describe("calculateDeductibleCents — one row per Section 5 table entry", () => {
  it("AUCTION_WIN: deductible is amount minus FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "AUCTION_WIN",
      amountCents: 15_000,
      fmvCents: 6_000,
    });
    expect(result.deductibleCents).toBe(9_000);
  });

  it("RAFFLE: always zero, regardless of amount or FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "RAFFLE",
      amountCents: 10_000,
      fmvCents: 0,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("RAFFLE: still zero even if an FMV is (incorrectly) supplied", () => {
    const result = calculateDeductibleCents({
      lineType: "RAFFLE",
      amountCents: 10_000,
      fmvCents: 500,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("FUND_A_NEED: full amount is deductible", () => {
    const result = calculateDeductibleCents({
      lineType: "FUND_A_NEED",
      amountCents: 25_000,
    });
    expect(result.deductibleCents).toBe(25_000);
  });

  it("CASH_GIFT: full amount is deductible", () => {
    const result = calculateDeductibleCents({
      lineType: "CASH_GIFT",
      amountCents: 5_000,
    });
    expect(result.deductibleCents).toBe(5_000);
  });

  it("TICKET: deductible is amount minus meal/entertainment FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "TICKET",
      amountCents: 15_000,
      fmvCents: 7_500,
    });
    expect(result.deductibleCents).toBe(7_500);
  });

  it("SPONSORSHIP: deductible is amount minus value of benefits received", () => {
    const result = calculateDeductibleCents({
      lineType: "SPONSORSHIP",
      amountCents: 500_000,
      fmvCents: 50_000,
    });
    expect(result.deductibleCents).toBe(450_000);
  });

  it("MERCH: zero when priced at or below FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "MERCH",
      amountCents: 2_000,
      fmvCents: 2_000,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("MERCH: the excess over FMV when priced above it", () => {
    const result = calculateDeductibleCents({
      lineType: "MERCH",
      amountCents: 3_000,
      fmvCents: 2_000,
    });
    expect(result.deductibleCents).toBe(1_000);
  });

  it("covers every line type declared in TRANSACTION_LINE_TYPES", () => {
    // Guards against a new line type being added to the enum without a
    // corresponding test above.
    const coveredInThisDescribeBlock: Record<string, true> = {
      AUCTION_WIN: true,
      RAFFLE: true,
      FUND_A_NEED: true,
      CASH_GIFT: true,
      TICKET: true,
      SPONSORSHIP: true,
      MERCH: true,
    };
    for (const lineType of TRANSACTION_LINE_TYPES) {
      expect(coveredInThisDescribeBlock[lineType]).toBe(true);
    }
  });
});

describe("calculateDeductibleCents — zero and negative edge cases", () => {
  it("floors at zero when the winning bid is below FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "AUCTION_WIN",
      amountCents: 4_000,
      fmvCents: 6_000,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("floors at zero for TICKET when paid below FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "TICKET",
      amountCents: 1_000,
      fmvCents: 7_500,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("floors at zero for SPONSORSHIP when paid below FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "SPONSORSHIP",
      amountCents: 10_000,
      fmvCents: 50_000,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("is zero, not negative, when amount exactly equals FMV", () => {
    const result = calculateDeductibleCents({
      lineType: "AUCTION_WIN",
      amountCents: 6_000,
      fmvCents: 6_000,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("handles a zero-dollar amount", () => {
    const result = calculateDeductibleCents({
      lineType: "CASH_GIFT",
      amountCents: 0,
    });
    expect(result.deductibleCents).toBe(0);
  });

  it("defaults fmvCents to 0 when omitted", () => {
    const result = calculateDeductibleCents({
      lineType: "AUCTION_WIN",
      amountCents: 5_000,
    });
    expect(result.fmvCents).toBe(0);
    expect(result.deductibleCents).toBe(5_000);
  });

  it("rejects a non-integer amountCents", () => {
    expect(() =>
      calculateDeductibleCents({
        lineType: "CASH_GIFT",
        amountCents: 100.5,
      }),
    ).toThrow(InvalidMoneyInputError);
  });

  it("rejects a negative amountCents", () => {
    expect(() =>
      calculateDeductibleCents({
        lineType: "CASH_GIFT",
        amountCents: -100,
      }),
    ).toThrow(InvalidMoneyInputError);
  });

  it("rejects a negative fmvCents", () => {
    expect(() =>
      calculateDeductibleCents({
        lineType: "AUCTION_WIN",
        amountCents: 1_000,
        fmvCents: -1,
      }),
    ).toThrow(InvalidMoneyInputError);
  });
});

describe("calculateTransactionDeductibleCents — full mixed-line transaction", () => {
  it("rolls up a checkout with an auction win, a raffle, fund-a-need, and a cash gift", () => {
    // A single bidder's consolidated checkout at the end of the night:
    //  - won a silent auction item for $150, FMV $60  -> $90 deductible
    //  - bought 5 raffle tickets for $25               -> $0 deductible
    //  - gave $200 at the fund-a-need appeal            -> $200 deductible
    //  - added a $50 cash gift at checkout              -> $50 deductible
    const summary = calculateTransactionDeductibleCents([
      { lineType: "AUCTION_WIN", amountCents: 15_000, fmvCents: 6_000 },
      { lineType: "RAFFLE", amountCents: 2_500 },
      { lineType: "FUND_A_NEED", amountCents: 20_000 },
      { lineType: "CASH_GIFT", amountCents: 5_000 },
    ]);

    expect(summary.totalAmountCents).toBe(15_000 + 2_500 + 20_000 + 5_000);
    expect(summary.totalFmvCents).toBe(6_000);
    expect(summary.totalDeductibleCents).toBe(9_000 + 0 + 20_000 + 5_000);
    expect(summary.lines).toHaveLength(4);
    expect(summary.lines[0].deductibleCents).toBe(9_000);
    expect(summary.lines[1].deductibleCents).toBe(0);
    expect(summary.lines[2].deductibleCents).toBe(20_000);
    expect(summary.lines[3].deductibleCents).toBe(5_000);
  });

  it("rolls up a transaction where every line type is below or at FMV, all zero", () => {
    const summary = calculateTransactionDeductibleCents([
      { lineType: "AUCTION_WIN", amountCents: 1_000, fmvCents: 1_000 },
      { lineType: "TICKET", amountCents: 500, fmvCents: 5_000 },
      { lineType: "MERCH", amountCents: 200, fmvCents: 200 },
    ]);
    expect(summary.totalDeductibleCents).toBe(0);
  });

  it("returns zero totals for an empty transaction", () => {
    const summary = calculateTransactionDeductibleCents([]);
    expect(summary.totalAmountCents).toBe(0);
    expect(summary.totalFmvCents).toBe(0);
    expect(summary.totalDeductibleCents).toBe(0);
    expect(summary.lines).toEqual([]);
  });

  it("propagates a validation error from any single bad line", () => {
    expect(() =>
      calculateTransactionDeductibleCents([
        { lineType: "CASH_GIFT", amountCents: 1_000 },
        { lineType: "AUCTION_WIN", amountCents: -1, fmvCents: 0 },
      ]),
    ).toThrow(InvalidMoneyInputError);
  });
});
