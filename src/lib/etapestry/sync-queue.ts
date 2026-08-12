/**
 * Pure decision logic for the eTapestry sync queue (Section 7: "Sync is a
 * queue with retries, not a fire and forget call... A failed sync must be
 * visible and replayable from the admin UI"). The actual queue worker
 * (reading/writing SyncLog rows via Prisma, calling the adapter) is I/O
 * and lives elsewhere; this module is what it calls to decide what to do,
 * so the decision itself stays unit-testable without a database.
 */

export type SyncLogStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface SyncLogRecord {
  payloadHash: string;
  status: SyncLogStatus;
  attempts: number;
}

export type SyncDecision =
  | { action: "skip"; reason: string }
  | { action: "push" };

/**
 * Refuse to push the same gift twice: if this exact payload already synced
 * successfully, skip. Otherwise push — covers both "never attempted" and
 * "previous attempt(s) failed, retry."
 */
export function decideSyncAction(
  payloadHash: string,
  priorRecords: SyncLogRecord[],
): SyncDecision {
  const alreadySucceeded = priorRecords.some(
    (r) => r.payloadHash === payloadHash && r.status === "SUCCESS",
  );
  if (alreadySucceeded) {
    return {
      action: "skip",
      reason: "This exact payload already synced successfully.",
    };
  }
  return { action: "push" };
}

export const MAX_SYNC_ATTEMPTS = 5;

/**
 * Once a record has failed this many times without a payload change, stop
 * auto-retrying and surface it on the admin worklist for a human instead
 * of hammering eTapestry forever.
 */
export function shouldAutoRetry(record: SyncLogRecord): boolean {
  return record.status === "FAILED" && record.attempts < MAX_SYNC_ATTEMPTS;
}
