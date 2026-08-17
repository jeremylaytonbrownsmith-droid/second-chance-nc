import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSolicitationStatus } from "@/lib/admin/solicitations";
import { toErrorResponse } from "@/lib/http/handle-error";

const patchSchema = z.object({
  status: z.enum(["PROSPECT", "CONTACTED", "COMMITTED", "DECLINED", "DO_NOT_CONTACT"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { status } = patchSchema.parse(await request.json());
    const solicitation = await setSolicitationStatus(id, status);
    return NextResponse.json({ solicitation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
