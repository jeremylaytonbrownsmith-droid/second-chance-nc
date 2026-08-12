import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ClerkEntryError, recordHammerPrice } from "@/lib/auction/clerk";
import { toErrorResponse } from "@/lib/http/handle-error";

const hammerSchema = z.object({
  eventId: z.string().min(1),
  itemNumber: z.string().trim().min(1),
  bidderNumber: z.coerce.number().int().positive(),
  hammerPriceCents: z.number().int().positive(),
  actorId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = hammerSchema.parse(await request.json());
    const award = await recordHammerPrice(body);
    return NextResponse.json({ award });
  } catch (error) {
    if (error instanceof ClerkEntryError) {
      return NextResponse.json(
        { error: "clerk_entry_error", message: error.message },
        { status: 400 },
      );
    }
    return toErrorResponse(error);
  }
}
