import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  closeAuctionItem,
  openAuctionItemForBidding,
  updateAuctionItemFmv,
  voidAuctionItem,
} from "@/lib/admin/auction-items";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setFmv"),
    fmvCents: z.number().int().min(0),
    fmvBasis: z.string().trim().min(1),
  }),
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("close") }),
  z.object({
    action: z.literal("void"),
    reason: z.string().trim().min(1),
  }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actorId = await requireAdminRole(); // FMV/open/close/void are admin-only
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    switch (body.action) {
      case "setFmv": {
        const auctionItem = await updateAuctionItemFmv(id, body.fmvCents, body.fmvBasis, actorId);
        return NextResponse.json({ auctionItem });
      }
      case "open": {
        const auctionItem = await openAuctionItemForBidding(id, actorId);
        return NextResponse.json({ auctionItem });
      }
      case "close": {
        const auctionItem = await closeAuctionItem(id, actorId);
        return NextResponse.json({ auctionItem });
      }
      case "void": {
        const auctionItem = await voidAuctionItem(id, body.reason);
        return NextResponse.json({ auctionItem });
      }
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
