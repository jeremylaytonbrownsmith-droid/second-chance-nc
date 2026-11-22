import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkInConstituent, checkInWalkIn, AlreadyCheckedInError } from "@/lib/auction/checkin";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireStaffRole } from "@/lib/admin/session";

const checkInSchema = z.object({
  eventId: z.string().min(1),
  constituentId: z.string().min(1),
});

const walkInSchema = z.object({
  eventId: z.string().min(1),
  orgId: z.string().min(1),
  walkIn: z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().min(1).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireStaffRole(); // volunteers can check bidders in
    const body = await request.json();

    if ("walkIn" in body) {
      const { eventId, orgId, walkIn } = walkInSchema.parse(body);
      const registration = await checkInWalkIn(orgId, eventId, walkIn, actorId);
      return NextResponse.json({ registration });
    }

    const { eventId, constituentId } = checkInSchema.parse(body);
    const registration = await checkInConstituent(eventId, constituentId, actorId);
    return NextResponse.json({ registration });
  } catch (error) {
    if (error instanceof AlreadyCheckedInError) {
      return NextResponse.json({ error: "already_checked_in", message: error.message }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
