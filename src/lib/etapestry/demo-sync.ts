import { prisma } from "@/lib/prisma";
import { hashSyncPayload } from "./payload-hash";
import { decideSyncAction } from "./sync-queue";

/**
 * Stand-in for the real eTapestry push (Section 7) while the org's API
 * access is still pending. Goes through the same idempotency/decision
 * logic the real sync worker will use (hash the payload, skip an
 * already-successful push, retry a failed one) and persists to SyncLog
 * so the admin sync log page reflects real queue state — only the actual
 * SOAP call is faked, deterministically "succeeding" so the rest of the
 * system can be built and demoed against it.
 */
export async function syncTransactionToEtapestry(transactionId: string) {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: {
      lines: { where: { voidedAt: null } },
      registration: { include: { constituent: true } },
    },
  });

  const payload = {
    constituentId: transaction.registration.constituentId,
    constituentEmail: transaction.registration.constituent.email,
    lines: transaction.lines.map((l) => ({
      lineType: l.lineType,
      amountCents: l.amountCents,
      deductibleCents: l.deductibleCents,
    })),
    totalCents: transaction.totalCents,
  };
  const payloadHash = hashSyncPayload(payload);

  const priorRecords = await prisma.syncLog.findMany({
    where: { entityType: "GIFT", localId: transactionId },
    orderBy: { createdAt: "desc" },
  });

  const decision = decideSyncAction(
    payloadHash,
    priorRecords.map((r) => ({
      payloadHash: r.payloadHash,
      status: r.status,
      attempts: r.attempts,
    })),
  );

  if (decision.action === "skip") {
    return { skipped: true as const, reason: decision.reason };
  }

  const remoteRef = `demo-etapestry-gift-${transactionId.slice(0, 8)}`;

  // A row with this exact (entityType, localId, payloadHash) may already
  // exist from a prior failed attempt — the unique constraint means a
  // retry with an unchanged payload must UPDATE that row, not insert a
  // second one. Only a genuinely new payload (different hash) gets a
  // fresh row.
  const existingSameHash = priorRecords.find((r) => r.payloadHash === payloadHash);

  const log = existingSameHash
    ? await prisma.syncLog.update({
        where: { id: existingSameHash.id },
        data: {
          status: "SUCCESS",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          remoteRef,
        },
      })
    : await prisma.syncLog.create({
        data: {
          entityType: "GIFT",
          localId: transactionId,
          remoteRef,
          status: "SUCCESS",
          attempts: 1,
          lastAttemptAt: new Date(),
          payloadHash,
        },
      });

  return { skipped: false as const, syncLog: log };
}

export async function listRecentSyncLogs(limit = 50) {
  return prisma.syncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
