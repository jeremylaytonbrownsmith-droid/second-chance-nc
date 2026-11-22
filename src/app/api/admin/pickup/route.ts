import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AwardNotFoundError, markAwardPickedUp, unmarkAwardPickedUp } from "@/lib/auction/pickup";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireStaffRole } from "@/lib/admin/session";

const pickupSchema = z.object({
  awardId: z.string().min(1),
  pickedUp: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireStaffRole(); // volunteers may record pickup
    const body = pickupSchema.parse(await request.json());
    const award = body.pickedUp
      ? await markAwardPickedUp(body.awardId, actorId)
      : await unmarkAwardPickedUp(body.awardId, actorId);
    return NextResponse.json({ award });
  } catch (error) {
    if (error instanceof AwardNotFoundError) {
      return NextResponse.json({ error: "not_found", message: error.message }, { status: 404 });
    }
    return toErrorResponse(error);
  }
}
