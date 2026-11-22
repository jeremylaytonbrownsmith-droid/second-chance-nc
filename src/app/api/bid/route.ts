import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BidRateLimitError,
  BidTooLowError,
  ItemNotOpenError,
  placeBid,
} from "@/lib/auction/bidding";
import { InvalidMoneyInputError } from "@/lib/money/deductible";

const placeBidSchema = z.object({
  itemId: z.string().min(1),
  registrationId: z.string().min(1),
  amountCents: z.number().int().positive(),
  source: z.enum(["MOBILE", "PAPER", "AUCTIONEER"]).default("MOBILE"),
  isMaxBid: z.boolean().default(false),
  // Event night, item 15 (offline resilience): set by the client's
  // offline queue so a retried bid is recognized as a replay, not a new
  // bid — see placeBid in src/lib/auction/bidding.ts.
  clientRequestId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = placeBidSchema.parse(await request.json());
    const result = await placeBid(body);
    return NextResponse.json({
      currentAmountCents: result.currentAmountCents,
      bidCount: result.bidCount,
    });
  } catch (error) {
    if (error instanceof BidTooLowError) {
      return NextResponse.json(
        {
          error: "bid_too_low",
          message: error.message,
          minimumRequiredCents: error.minimumRequiredCents,
        },
        { status: 409 },
      );
    }
    if (error instanceof ItemNotOpenError) {
      return NextResponse.json(
        { error: "item_not_open", message: error.message },
        { status: 409 },
      );
    }
    if (error instanceof BidRateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: error.message },
        { status: 429 },
      );
    }
    if (error instanceof InvalidMoneyInputError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "internal_error", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
