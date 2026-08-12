import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import { evaluateItemDonorSubstantiation } from "@/lib/money/substantiation";
import type { CsvColumn } from "@/lib/csv/to-csv";
import type { ItemDonor } from "@prisma/client";

export const createItemDonorSchema = z.object({
  eventId: z.string().min(1),
  constituentId: z.string().min(1),
  claimedValueCents: z.number().int().min(0),
});

export type CreateItemDonorInput = z.infer<typeof createItemDonorSchema>;

export async function listItemDonors(eventId: string): Promise<ItemDonor[]> {
  return prisma.itemDonor.findMany({
    where: { eventId, voidedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Claimed value drives the 8283 substantiation flag (Section 5 rule 4), so
 * this is audited even though it isn't a Transaction — a mis-set claimed
 * value changes a downstream tax filing obligation.
 */
export async function createItemDonor(
  input: CreateItemDonorInput,
  actorId: string,
): Promise<ItemDonor> {
  const data = createItemDonorSchema.parse(input);
  const { substantiationNeeded } = evaluateItemDonorSubstantiation(
    data.claimedValueCents,
  );
  // Generated up front (rather than left to Prisma's @default(cuid())) so
  // the audit row can reference the real id instead of a placeholder.
  const id = randomUUID();

  return auditedMutation({
    actorId,
    entityType: "ItemDonor",
    entityId: id,
    action: "create",
    before: async () => null,
    mutate: (tx) =>
      tx.itemDonor.create({
        data: { id, ...data, substantiationNeeded },
      }),
    after: async (_tx, result) => result,
  });
}

export async function recordForm8283Received(
  id: string,
  actorId: string,
): Promise<ItemDonor> {
  return auditedMutation({
    actorId,
    entityType: "ItemDonor",
    entityId: id,
    action: "form_8283_received",
    before: (tx) => tx.itemDonor.findUniqueOrThrow({ where: { id } }),
    mutate: (tx) =>
      tx.itemDonor.update({
        where: { id },
        data: { form8283ReceivedAt: new Date() },
      }),
    after: async (_tx, result) => result,
  });
}

export async function voidItemDonor(
  id: string,
  reason: string,
): Promise<ItemDonor> {
  return prisma.itemDonor.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });
}

export const itemDonorCsvColumns: CsvColumn<ItemDonor>[] = [
  { header: "ID", value: (d) => d.id },
  { header: "Event ID", value: (d) => d.eventId },
  { header: "Constituent ID", value: (d) => d.constituentId },
  { header: "Claimed Value (cents)", value: (d) => d.claimedValueCents },
  { header: "Substantiation Needed", value: (d) => d.substantiationNeeded },
  { header: "Form 8283 Received At", value: (d) => d.form8283ReceivedAt },
  { header: "Form 8282 Due At", value: (d) => d.form8282DueAt },
  { header: "Form 8282 Filed At", value: (d) => d.form8282FiledAt },
  { header: "Voided At", value: (d) => d.voidedAt },
];
