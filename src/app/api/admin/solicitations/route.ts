import { NextRequest, NextResponse } from "next/server";
import { SolicitationStatus } from "@prisma/client";
import {
  createSolicitation,
  listSolicitations,
  solicitationCsvColumns,
} from "@/lib/admin/solicitations";
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
  const statusParam = request.nextUrl.searchParams.get("status");
  const category = request.nextUrl.searchParams.get("category") ?? undefined;
  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const status =
    statusParam && (Object.values(SolicitationStatus) as string[]).includes(statusParam)
      ? (statusParam as SolicitationStatus)
      : undefined;

  const solicitations = await listSolicitations(eventId, { status, category, search });

  if (format === "csv") {
    return new NextResponse(toCsv(solicitations, solicitationCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="solicitations.csv"',
      },
    });
  }

  return NextResponse.json({ solicitations });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const solicitation = await createSolicitation(body);
    return NextResponse.json({ solicitation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
