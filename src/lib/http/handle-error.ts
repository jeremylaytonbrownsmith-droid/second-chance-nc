import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { InvalidMoneyInputError } from "@/lib/money/deductible";
import { ItemNotReadyToOpenError } from "@/lib/money/substantiation";
import { ForbiddenRoleError, UnauthenticatedError } from "@/lib/admin/session";
import { PaymentDeclinedError } from "@/lib/checkout/checkout";

/** Shared error -> HTTP response mapping for admin API routes. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "unauthenticated", message: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenRoleError) {
    return NextResponse.json({ error: "forbidden", message: error.message }, { status: 403 });
  }
  if (error instanceof PaymentDeclinedError) {
    return NextResponse.json({ error: "payment_declined", message: error.message }, { status: 402 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "validation_error", issues: error.issues },
      { status: 400 },
    );
  }
  if (
    error instanceof InvalidMoneyInputError ||
    error instanceof ItemNotReadyToOpenError
  ) {
    return NextResponse.json(
      { error: error.name, message: error.message },
      { status: 400 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: "conflict",
          message: `Duplicate value for ${(error.meta?.target as string[] | undefined)?.join(", ") ?? "a unique field"}`,
        },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "not_found", message: "Record not found" },
        { status: 404 },
      );
    }
  }
  console.error(error);
  return NextResponse.json(
    { error: "internal_error", message: "Something went wrong" },
    { status: 500 },
  );
}
