import { NextRequest, NextResponse } from "next/server";
import {
  auctionItemCsvColumns,
  createAuctionItem,
  listAuctionItems,
} from "@/lib/admin/auction-items";
import { toCsv } from "@/lib/csv/to-csv";
import { toErrorResponse } from "@/lib/http/handle-error";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const eventId = request.nextUrl.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { error: "validation_error", message: "eventId is required" },
      { status: 400 },
    );
  }

  const auctionItems = await listAuctionItems(eventId);

  if (format === "csv") {
    return new NextResponse(toCsv(auctionItems, auctionItemCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="auction-items.csv"',
      },
    });
  }

  return NextResponse.json({ auctionItems });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auctionItem = await createAuctionItem(body);
    return NextResponse.json({ auctionItem }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
