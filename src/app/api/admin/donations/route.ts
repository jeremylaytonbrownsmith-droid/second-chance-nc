import { NextRequest, NextResponse } from "next/server";
import { logDonation } from "@/lib/admin/solicitations";
import { toErrorResponse } from "@/lib/http/handle-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await logDonation(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
