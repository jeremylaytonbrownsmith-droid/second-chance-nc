import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { runCheckout } from "@/lib/checkout/checkout";
import { InvalidMoneyInputError } from "@/lib/money/deductible";

/**
 * Self-serve guest donation — a bidder giving a general cash gift from
 * their own phone, the same flow GiveSmart's "Donate Now" tile covers.
 * Not gated behind admin auth (same as /api/bid): a guest never logs in.
 * Goes through the same runCheckout() every staff-entered gift uses, so
 * it gets the same deductible math, audit row, and eTapestry sync queue
 * — only the amount and source differ from a staff checkout.
 */
const donateSchema = z.object({
  registrationId: z.string().min(1),
  amountCents: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const body = donateSchema.parse(await request.json());
    const result = await runCheckout({
      registrationId: body.registrationId,
      lines: [{ lineType: "CASH_GIFT", amountCents: body.amountCents }],
      method: "CARD",
      actorId: "Guest self-serve",
    });
    return NextResponse.json({
      transactionId: result.transaction.id,
      totalAmountCents: result.totalAmountCents,
      totalDeductibleCents: result.totalDeductibleCents,
    });
  } catch (error) {
    if (error instanceof InvalidMoneyInputError) {
      return NextResponse.json(
        { error: "validation_error", message: error.message },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "registration_not_found", message: "That bidder link isn't valid." },
        { status: 404 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "internal_error", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
