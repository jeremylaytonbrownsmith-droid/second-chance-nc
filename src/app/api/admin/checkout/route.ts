import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOutstandingAwardsForRegistration,
  runCheckout,
} from "@/lib/checkout/checkout";
import { toErrorResponse } from "@/lib/http/handle-error";

export async function GET(request: NextRequest) {
  const registrationId = request.nextUrl.searchParams.get("registrationId");
  if (!registrationId) {
    return NextResponse.json(
      { error: "validation_error", message: "registrationId is required" },
      { status: 400 },
    );
  }
  const outstandingAwards = await getOutstandingAwardsForRegistration(registrationId);
  return NextResponse.json({ outstandingAwards });
}

const lineSchema = z.object({
  lineType: z.enum([
    "AUCTION_WIN",
    "RAFFLE",
    "FUND_A_NEED",
    "CASH_GIFT",
    "TICKET",
    "SPONSORSHIP",
    "MERCH",
  ]),
  amountCents: z.number().int().positive(),
  fmvCents: z.number().int().min(0).optional(),
  awardId: z.string().optional(),
  designation: z.string().optional(),
});

const checkoutSchema = z.object({
  registrationId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
  method: z.enum(["CARD", "CASH", "CHECK"]),
  actorId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = checkoutSchema.parse(await request.json());
    const result = await runCheckout(body);
    return NextResponse.json({
      transactionId: result.transaction.id,
      totalAmountCents: result.totalAmountCents,
      totalDeductibleCents: result.totalDeductibleCents,
      quidProQuoDisclosureRequired: result.quidProQuoDisclosureRequired,
      writtenAcknowledgmentRequired: result.writtenAcknowledgmentRequired,
      lines: result.lines,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
