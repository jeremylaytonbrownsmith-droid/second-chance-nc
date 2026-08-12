import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * CLAUDE.md hard rule 3: every mutation that touches money writes an audit
 * row — who, what, when, before value, after value. Use `auditedMutation`
 * for anything that creates or changes a Transaction, TransactionLine,
 * Award, Bid amount, or Receipt so the write and its audit row commit
 * together or not at all.
 */

export interface RecordAuditParams {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
}

export async function recordAudit(
  tx: Prisma.TransactionClient | PrismaClient,
  params: RecordAuditParams,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: params.actorId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeJson:
        params.beforeJson === undefined
          ? undefined
          : (params.beforeJson as Prisma.InputJsonValue),
      afterJson:
        params.afterJson === undefined
          ? undefined
          : (params.afterJson as Prisma.InputJsonValue),
      ip: params.ip ?? null,
    },
  });
}

export interface AuditedMutationParams<T> {
  actorId: string;
  ip?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  /** Read the pre-mutation state inside the same transaction. */
  before: (tx: Prisma.TransactionClient) => Promise<unknown>;
  /** Perform the mutation. Runs inside the same transaction as the audit row. */
  mutate: (tx: Prisma.TransactionClient) => Promise<T>;
  /** Read the post-mutation state to record as afterJson. */
  after: (tx: Prisma.TransactionClient, result: T) => Promise<unknown>;
}

/**
 * Runs `before` → `mutate` → `after` → audit-row-write inside one Prisma
 * transaction. If any step throws, nothing commits — a money mutation can
 * never land without its audit row.
 */
export async function auditedMutation<T>(
  params: AuditedMutationParams<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const beforeJson = await params.before(tx);
    const result = await params.mutate(tx);
    const afterJson = await params.after(tx, result);
    await recordAudit(tx, {
      actorId: params.actorId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeJson,
      afterJson,
      ip: params.ip,
    });
    return result;
  });
}
