import { NextRequest, NextResponse } from "next/server";
import { logDonation } from "@/lib/admin/solicitations";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireAdminRole(); // donor/item-donation intake is admin-only
    const body = await request.json();
    // actorId always comes from the verified session, never the client —
    // overwrite whatever (if anything) the request body sent.
    const result = await logDonation({ ...body, actorId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
