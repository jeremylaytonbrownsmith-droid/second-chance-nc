import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import { createConstituent } from "@/lib/admin/constituents";
import type { Registration } from "@prisma/client";

/**
 * QR check-in (Event night, item 8): assigns the next paddle number and
 * marks a bidder checked in, in one step — whether they pre-registered
 * (a Registration already exists for them, from the spreadsheet import or
 * a future online pre-registration flow) or are a walk-up with no
 * Registration yet. Either way this is the one function both paths call,
 * so "checked in" always means the same thing in the data.
 *
 * Paddle numbers are per-event and sequential — Registration.bidderNumber
 * has a @@unique([eventId, bidderNumber]) constraint, so two concurrent
 * check-ins racing for the same number fails loudly (a unique constraint
 * violation) rather than silently handing out a duplicate paddle; the
 * caller should retry on that specific error.
 */

export class AlreadyCheckedInError extends Error {
  constructor() {
    super("This constituent is already checked in to this event.");
    this.name = "AlreadyCheckedInError";
  }
}

async function nextBidderNumber(eventId: string): Promise<number> {
  const highest = await prisma.registration.findFirst({
    where: { eventId },
    orderBy: { bidderNumber: "desc" },
    select: { bidderNumber: true },
  });
  return (highest?.bidderNumber ?? 100) + 1;
}

export async function checkInConstituent(
  eventId: string,
  constituentId: string,
  actorId: string,
): Promise<Registration> {
  const existing = await prisma.registration.findFirst({
    where: { eventId, constituentId, voidedAt: null },
  });

  if (existing) {
    if (existing.checkedInAt) throw new AlreadyCheckedInError();
    return auditedMutation({
      actorId,
      entityType: "Registration",
      entityId: existing.id,
      action: "check_in",
      before: async () => existing,
      mutate: (tx) =>
        tx.registration.update({
          where: { id: existing.id },
          data: { checkedInAt: new Date(), status: "CHECKED_IN" },
        }),
      after: async (_tx, result) => result,
    });
  }

  const bidderNumber = await nextBidderNumber(eventId);
  const registrationId = crypto.randomUUID();
  return auditedMutation({
    actorId,
    entityType: "Registration",
    entityId: registrationId,
    action: "check_in_new",
    before: async () => null,
    mutate: (tx) =>
      tx.registration.create({
        data: {
          id: registrationId,
          eventId,
          constituentId,
          bidderNumber,
          checkedInAt: new Date(),
          status: "CHECKED_IN",
        },
      }),
    after: async (_tx, result) => result,
  });
}

export interface WalkInInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

/** A guest with no constituent record yet — a genuine walk-up, not
 * already in the system from a prior import or an earlier gala. Creates
 * the bare minimum contact record (no business/donor fields — that's
 * the admin-only constituent form's job, see src/app/admin/actions.ts)
 * and checks them in in the same step, so a volunteer at the door never
 * has to hand this off to an admin mid-line. */
export async function checkInWalkIn(
  orgId: string,
  eventId: string,
  input: WalkInInput,
  actorId: string,
): Promise<Registration> {
  const constituent = await createConstituent({
    orgId,
    isBusiness: false,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? "",
    phone: input.phone,
  });
  return checkInConstituent(eventId, constituent.id, actorId);
}
