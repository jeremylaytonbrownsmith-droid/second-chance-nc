import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buyItNow, BuyNowUnavailableError, ItemNotOpenError } from "@/lib/auction/bidding";
import { toErrorResponse } from "@/lib/http/handle-error";

const buyNowSchema = z.object({
  itemId: z.string().min(1),
  registrationId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { itemId, registrationId } = buyNowSchema.parse(await request.json());
    // Guest-facing route, deliberately no staff role check — same model as
    // /api/bid and /api/donate: an unguessable registrationId stands in for
    // auth, same as every other guest route.
    const award = await buyItNow(itemId, registrationId, "Guest self-serve");
    return NextResponse.json({ award });
  } catch (error) {
    if (error instanceof BuyNowUnavailableError) {
      return NextResponse.json({ error: "buy_now_unavailable", message: error.message }, { status: 409 });
    }
    if (error instanceof ItemNotOpenError) {
      return NextResponse.json({ error: "item_not_open", message: error.message }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
