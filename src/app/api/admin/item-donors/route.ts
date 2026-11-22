import { NextRequest, NextResponse } from "next/server";
import {
  createItemDonor,
  itemDonorCsvColumns,
  listItemDonors,
} from "@/lib/admin/item-donors";
import { toCsv } from "@/lib/csv/to-csv";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const eventId = request.nextUrl.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { error: "validation_error", message: "eventId is required" },
      { status: 400 },
    );
  }

  const itemDonors = await listItemDonors(eventId);

  if (format === "csv") {
    return new NextResponse(toCsv(itemDonors, itemDonorCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="item-donors.csv"',
      },
    });
  }

  return NextResponse.json({ itemDonors });
}

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireAdminRole(); // donors are admin-only
    const body = await request.json();
    const itemDonor = await createItemDonor(body, actorId);
    return NextResponse.json({ itemDonor }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
