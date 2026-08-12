import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { syncTransactionToEtapestry } from "@/lib/etapestry/demo-sync";
import { toErrorResponse } from "@/lib/http/handle-error";

const retrySchema = z.object({ transactionId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const { transactionId } = retrySchema.parse(await request.json());
    const result = await syncTransactionToEtapestry(transactionId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
