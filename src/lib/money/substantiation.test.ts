import { describe, expect, it } from "vitest";
import {
  assertItemCanOpenForBidding,
  calculateForm8282DueDate,
  evaluateItemDonorSubstantiation,
  FORM_8282_DUE_DAYS,
  ItemNotReadyToOpenError,
  requiresQuidProQuoDisclosure,
  requiresWrittenAcknowledgment,
} from "./substantiation";
import { InvalidMoneyInputError } from "./deductible";

describe("requiresQuidProQuoDisclosure", () => {
  it("does not trigger at exactly $75 with goods/services received", () => {
    expect(requiresQuidProQuoDisclosure(7_500, true)).toBe(false);
  });

  it("triggers just above $75 with goods/services received", () => {
    expect(requiresQuidProQuoDisclosure(7_501, true)).toBe(true);
  });

  it("does not trigger above $75 when nothing was received in return", () => {
    expect(requiresQuidProQuoDisclosure(100_000, false)).toBe(false);
  });

  it("does not trigger below the threshold even with goods/services received", () => {
    expect(requiresQuidProQuoDisclosure(1_000, true)).toBe(false);
  });
});

describe("requiresWrittenAcknowledgment", () => {
  it("triggers at exactly $250", () => {
    expect(requiresWrittenAcknowledgment(25_000)).toBe(true);
  });

  it("triggers above $250", () => {
    expect(requiresWrittenAcknowledgment(100_000)).toBe(true);
  });

  it("does not trigger just below $250", () => {
    expect(requiresWrittenAcknowledgment(24_999)).toBe(false);
  });

  it("does not trigger for a small gift", () => {
    expect(requiresWrittenAcknowledgment(500)).toBe(false);
  });
});

describe("evaluateItemDonorSubstantiation", () => {
  it("needs nothing for a claim at exactly $500", () => {
    const result = evaluateItemDonorSubstantiation(50_000);
    expect(result.substantiationNeeded).toBe(false);
    expect(result.requiresPartIVSignature).toBe(false);
  });

  it("needs 8283 just above $500", () => {
    const result = evaluateItemDonorSubstantiation(50_001);
    expect(result.substantiationNeeded).toBe(true);
    expect(result.requiresPartIVSignature).toBe(false);
  });

  it("still only needs 8283 (not Part IV) at exactly $5,000", () => {
    const result = evaluateItemDonorSubstantiation(500_000);
    expect(result.substantiationNeeded).toBe(true);
    expect(result.requiresPartIVSignature).toBe(false);
  });

  it("needs Part IV signature just above $5,000", () => {
    const result = evaluateItemDonorSubstantiation(500_001);
    expect(result.substantiationNeeded).toBe(true);
    expect(result.requiresPartIVSignature).toBe(true);
  });

  it("needs nothing for a low-value item", () => {
    const result = evaluateItemDonorSubstantiation(1_000);
    expect(result.substantiationNeeded).toBe(false);
    expect(result.requiresPartIVSignature).toBe(false);
  });
});

describe("calculateForm8282DueDate", () => {
  it("returns null at exactly the Part IV threshold — no obligation", () => {
    expect(
      calculateForm8282DueDate(new Date("2027-04-15T00:00:00Z"), 500_000),
    ).toBeNull();
  });

  it("returns null below the threshold", () => {
    expect(
      calculateForm8282DueDate(new Date("2027-04-15T00:00:00Z"), 10_000),
    ).toBeNull();
  });

  it("returns a due date 125 days after the sale when above the threshold", () => {
    const saleDate = new Date("2027-04-15T00:00:00Z");
    const due = calculateForm8282DueDate(saleDate, 500_001);
    expect(due).not.toBeNull();

    const expected = new Date(saleDate.getTime());
    expected.setUTCDate(expected.getUTCDate() + FORM_8282_DUE_DAYS);
    expect(due!.getTime()).toBe(expected.getTime());
    expect(due!.toISOString().slice(0, 10)).toBe("2027-08-18");
  });

  it("rejects a negative claimed value", () => {
    expect(() =>
      calculateForm8282DueDate(new Date("2027-04-15T00:00:00Z"), -1),
    ).toThrow(InvalidMoneyInputError);
  });
});

describe("assertItemCanOpenForBidding", () => {
  it("allows an item with FMV set, including zero", () => {
    expect(() => assertItemCanOpenForBidding({ fmvCents: 0 })).not.toThrow();
    expect(() =>
      assertItemCanOpenForBidding({ fmvCents: 10_000 }),
    ).not.toThrow();
  });

  it("blocks an item with no FMV set", () => {
    expect(() => assertItemCanOpenForBidding({ fmvCents: null })).toThrow(
      ItemNotReadyToOpenError,
    );
    expect(() =>
      assertItemCanOpenForBidding({ fmvCents: undefined }),
    ).toThrow(ItemNotReadyToOpenError);
  });

  it("blocks an item with a negative FMV", () => {
    expect(() =>
      assertItemCanOpenForBidding({ fmvCents: -100 }),
    ).toThrow(InvalidMoneyInputError);
  });
});
