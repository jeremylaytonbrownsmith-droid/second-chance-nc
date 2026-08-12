import { NextRequest, NextResponse } from "next/server";
import { createEvent, eventCsvColumns, listEvents } from "@/lib/admin/events";
import { toCsv } from "@/lib/csv/to-csv";
import { toErrorResponse } from "@/lib/http/handle-error";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const orgId = request.nextUrl.searchParams.get("orgId") ?? undefined;
  const events = await listEvents(orgId);

  if (format === "csv") {
    return new NextResponse(toCsv(events, eventCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="events.csv"',
      },
    });
  }

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = await createEvent(body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
