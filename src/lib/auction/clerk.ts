import { randomUUID } from "node:crypto";
import { auditedMutation } from "@/lib/audit";
import { assertCents } from "@/lib/money/deductible";
import type { Award } from "@prisma/client";

/**
 * Live auction clerk entry (Section 8): item number, paddle number,
 * hammer price, next. One call per hammer, no bidding path involved —
 * the auctioneer already ran the bidding out loud.
 */

export class ClerkEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClerkEntryError";
  }
}

export interface RecordHammerPriceInput {
  eventId: string;
  itemNumber: string;
  bidderNumber: number;
  hammerPriceCents: number;
  actorId: string;
}

export async function recordHammerPrice(
  input: RecordHammerPriceInput,
): Promise<Award & { itemTitle: string }> {
  assertCents(input.hammerPriceCents, "hammerPriceCents");
  const id = randomUUID();

  const award = await auditedMutation({
    actorId: input.actorId,
    entityType: "Award",
    entityId: id,
    action: "hammer_price",
    before: async () => null,
    mutate: async (tx) => {
      const item = await tx.auctionItem.findFirst({
        where: {
          eventId: input.eventId,
          itemNumber: input.itemNumber,
          voidedAt: null,
        },
      });
      if (!item) {
        throw new ClerkEntryError(`No item numbered "${input.itemNumber}" in this event`);
      }

      const registration = await tx.registration.findFirst({
        where: {
          eventId: input.eventId,
          bidderNumber: input.bidderNumber,
          voidedAt: null,
        },
      });
      if (!registration) {
        throw new ClerkEntryError(`No bidder numbered ${input.bidderNumber} in this event`);
      }

      const created = await tx.award.create({
        data: {
          id,
          itemId: item.id,
          registrationId: registration.id,
          amountCents: input.hammerPriceCents,
        },
      });

      await tx.auctionItem.update({
        where: { id: item.id },
        data: { status: "AWARDED" },
      });

      return { ...created, itemTitle: item.title };
    },
    after: async (_tx, result) => result,
  });

  return award;
}
