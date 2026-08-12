import { describe, expect, it } from "vitest";
import { hashSyncPayload } from "./payload-hash";

describe("hashSyncPayload", () => {
  it("is deterministic for the same payload", () => {
    const payload = { amountCents: 15_000, giftDate: "2027-04-15" };
    expect(hashSyncPayload(payload)).toBe(hashSyncPayload(payload));
  });

  it("is order-independent for object keys", () => {
    const a = { amountCents: 15_000, fund: "General" };
    const b = { fund: "General", amountCents: 15_000 };
    expect(hashSyncPayload(a)).toBe(hashSyncPayload(b));
  });

  it("hashes Date instances the same as their ISO string equivalent structure", () => {
    const date = new Date("2027-04-15T00:00:00Z");
    const a = { giftDate: date };
    const b = { giftDate: date.toISOString() };
    expect(hashSyncPayload(a)).toBe(hashSyncPayload(b));
  });

  it("produces a different hash when a value changes", () => {
    const a = { amountCents: 15_000 };
    const b = { amountCents: 15_001 };
    expect(hashSyncPayload(a)).not.toBe(hashSyncPayload(b));
  });

  it("ignores key order in nested objects", () => {
    const a = { gift: { amountCents: 1_000, fund: "General" }, note: "x" };
    const b = { note: "x", gift: { fund: "General", amountCents: 1_000 } };
    expect(hashSyncPayload(a)).toBe(hashSyncPayload(b));
  });

  it("treats undefined values as absent, matching JSON.stringify semantics", () => {
    const a = { amountCents: 1_000, note: undefined };
    const b = { amountCents: 1_000 };
    expect(hashSyncPayload(a)).toBe(hashSyncPayload(b));
  });
});
