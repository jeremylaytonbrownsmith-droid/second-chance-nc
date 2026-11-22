import { auditedMutation } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * Pickup tracking (Event night, item 13): a volunteer-permitted action,
 * same tier as check-in and bid entry — it moves nothing financial, just
 * marks that the winner physically took their item home.
 */

export class AwardNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwardNotFoundError";
  }
}

export async function markAwardPickedUp(awardId: string, actorId: string) {
  return auditedMutation({
    actorId,
    entityType: "Award",
    entityId: awardId,
    action: "mark_picked_up",
    before: async (tx) => tx.award.findUnique({ where: { id: awardId } }),
    mutate: async (tx) => {
      const award = await tx.award.findFirst({ where: { id: awardId, voidedAt: null } });
      if (!award) {
        throw new AwardNotFoundError(`No such award: ${awardId}`);
      }
      return tx.award.update({ where: { id: awardId }, data: { pickedUpAt: new Date() } });
    },
    after: async (_tx, result) => result,
  });
}

export async function unmarkAwardPickedUp(awardId: string, actorId: string) {
  return auditedMutation({
    actorId,
    entityType: "Award",
    entityId: awardId,
    action: "unmark_picked_up",
    before: async (tx) => tx.award.findUnique({ where: { id: awardId } }),
    mutate: async (tx) => {
      const award = await tx.award.findFirst({ where: { id: awardId, voidedAt: null } });
      if (!award) {
        throw new AwardNotFoundError(`No such award: ${awardId}`);
      }
      return tx.award.update({ where: { id: awardId }, data: { pickedUpAt: null } });
    },
    after: async (_tx, result) => result,
  });
}

export interface PickupRow {
  awardId: string;
  itemNumber: string;
  itemTitle: string;
  bidderNumber: number;
  winnerName: string;
  amountCents: number;
  pickedUpAt: Date | null;
}

export async function listAwardsForPickup(eventId: string): Promise<PickupRow[]> {
  const awards = await prisma.award.findMany({
    where: { voidedAt: null, item: { eventId } },
    include: { item: true, registration: { include: { constituent: true } } },
    // Postgres's ASC default is NULLS LAST, which would push the unclaimed
    // (null pickedUpAt) items to the bottom — the opposite of what the
    // pickup table needs, so nulls-first is explicit here.
    orderBy: [{ pickedUpAt: { sort: "asc", nulls: "first" } }, { awardedAt: "asc" }],
  });

  return awards.map((a) => {
    const constituent = a.registration.constituent;
    const winnerName = constituent.isBusiness
      ? (constituent.orgName ?? "")
      : `${constituent.firstName ?? ""} ${constituent.lastName ?? ""}`.trim();
    return {
      awardId: a.id,
      itemNumber: a.item.itemNumber,
      itemTitle: a.item.title,
      bidderNumber: a.registration.bidderNumber,
      winnerName,
      amountCents: a.amountCents,
      pickedUpAt: a.pickedUpAt,
    };
  });
}
