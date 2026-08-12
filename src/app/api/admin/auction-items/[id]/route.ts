import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  closeAuctionItem,
  openAuctionItemForBidding,
  updateAuctionItemFmv,
  voidAuctionItem,
} from "@/lib/admin/auction-items";
import { toErrorResponse } from "@/lib/http/handle-error";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setFmv"),
    actorId: z.string().min(1),
    fmvCents: z.number().int().min(0),
    fmvBasis: z.string().trim().min(1),
  }),
  z.object({ action: z.literal("open"), actorId: z.string().min(1) }),
  z.object({ action: z.literal("close"), actorId: z.string().min(1) }),
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
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    switch (body.action) {
      case "setFmv": {
        const auctionItem = await updateAuctionItemFmv(
          id,
          body.fmvCents,
          body.fmvBasis,
          body.actorId,
        );
        return NextResponse.json({ auctionItem });
      }
      case "open": {
        const auctionItem = await openAuctionItemForBidding(id, body.actorId);
        return NextResponse.json({ auctionItem });
      }
      case "close": {
        const auctionItem = await closeAuctionItem(id, body.actorId);
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
