import { describe, expect, it } from "vitest";
import {
  decideSyncAction,
  MAX_SYNC_ATTEMPTS,
  shouldAutoRetry,
  type SyncLogRecord,
} from "./sync-queue";

describe("decideSyncAction", () => {
  it("pushes when there are no prior records", () => {
    expect(decideSyncAction("hash-a", [])).toEqual({ action: "push" });
  });

  it("skips when the exact payload already synced successfully", () => {
    const priorRecords: SyncLogRecord[] = [
      { payloadHash: "hash-a", status: "SUCCESS", attempts: 1 },
    ];
    const decision = decideSyncAction("hash-a", priorRecords);
    expect(decision.action).toBe("skip");
  });

  it("pushes (retries) when the same payload previously failed", () => {
    const priorRecords: SyncLogRecord[] = [
      { payloadHash: "hash-a", status: "FAILED", attempts: 2 },
    ];
    expect(decideSyncAction("hash-a", priorRecords)).toEqual({
      action: "push",
    });
  });

  it("pushes when the payload changed since the last successful sync", () => {
    const priorRecords: SyncLogRecord[] = [
      { payloadHash: "hash-old", status: "SUCCESS", attempts: 1 },
    ];
    expect(decideSyncAction("hash-new", priorRecords)).toEqual({
      action: "push",
    });
  });
});

describe("shouldAutoRetry", () => {
  it("retries a failed record under the attempt cap", () => {
    expect(
      shouldAutoRetry({ payloadHash: "h", status: "FAILED", attempts: 1 }),
    ).toBe(true);
  });

  it("stops retrying once attempts reach the cap", () => {
    expect(
      shouldAutoRetry({
        payloadHash: "h",
        status: "FAILED",
        attempts: MAX_SYNC_ATTEMPTS,
      }),
    ).toBe(false);
  });

  it("does not retry a record that already succeeded", () => {
    expect(
      shouldAutoRetry({ payloadHash: "h", status: "SUCCESS", attempts: 1 }),
    ).toBe(false);
  });

  it("does not retry a pending record", () => {
    expect(
      shouldAutoRetry({ payloadHash: "h", status: "PENDING", attempts: 0 }),
    ).toBe(false);
  });
});
