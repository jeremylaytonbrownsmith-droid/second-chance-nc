import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordFundANeedBatch } from "@/lib/auction/fund-a-need";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";

const batchSchema = z.object({
  eventId: z.string().min(1),
  amountCents: z.number().int().positive(),
  registrationIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireAdminRole(); // creates real charges, admin-only
    const body = batchSchema.parse(await request.json());
    const results = await recordFundANeedBatch(
      body.eventId,
      body.amountCents,
      body.registrationIds,
      actorId,
    );
    return NextResponse.json({ results });
  } catch (error) {
    return toErrorResponse(error);
  }
}
