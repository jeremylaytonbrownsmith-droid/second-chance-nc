import { prisma } from "@/lib/prisma";

export interface AuditLogRow {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
}

/**
 * AuditLog rows aren't tied to an event directly — they're keyed by
 * (entityType, entityId) for whatever got mutated (an AuctionItem, an
 * ItemDonor, a Transaction, an Award). To show "this event's history" we
 * collect the ids of this event's rows in each of those tables first, then
 * pull every audit row that points at one of them. Four small id lookups
 * plus one indexed audit query — not a join, because AuditLog has no FK
 * to any of them (entityType varies, so it can't).
 */
export async function listAuditLogsForEvent(eventId: string, limit = 100): Promise<AuditLogRow[]> {
  const [auctionItems, itemDonors, transactions, awards] = await Promise.all([
    prisma.auctionItem.findMany({ where: { eventId }, select: { id: true } }),
    prisma.itemDonor.findMany({ where: { eventId }, select: { id: true } }),
    prisma.transaction.findMany({ where: { eventId }, select: { id: true } }),
    prisma.award.findMany({ where: { item: { eventId } }, select: { id: true } }),
  ]);

  const auctionItemIds = auctionItems.map((r) => r.id);
  const itemDonorIds = itemDonors.map((r) => r.id);
  const transactionIds = transactions.map((r) => r.id);
  const awardIds = awards.map((r) => r.id);

  // AuditLog.entityId has no values to match against — skip the whole OR
  // branch for an empty array instead of asking Postgres to evaluate
  // `entityId IN ()`, which some Prisma versions reject outright.
  const orConditions = [
    auctionItemIds.length > 0 && { entityType: "AuctionItem", entityId: { in: auctionItemIds } },
    itemDonorIds.length > 0 && { entityType: "ItemDonor", entityId: { in: itemDonorIds } },
    transactionIds.length > 0 && { entityType: "Transaction", entityId: { in: transactionIds } },
    awardIds.length > 0 && { entityType: "Award", entityId: { in: awardIds } },
  ].filter((c): c is Exclude<typeof c, false> => c !== false);

  if (orConditions.length === 0) return [];

  return prisma.auditLog.findMany({
    where: { OR: orConditions },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
