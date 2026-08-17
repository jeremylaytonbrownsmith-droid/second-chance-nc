import { NextRequest, NextResponse } from "next/server";
import { SolicitationStatus } from "@prisma/client";
import {
  createSolicitation,
  listAllSolicitationsForExport,
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

  if (format === "csv") {
    const solicitations = await listAllSolicitationsForExport(eventId, { status, category, search });
    return new NextResponse(toCsv(solicitations, solicitationCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="solicitations.csv"',
      },
    });
  }

  const page = Number(request.nextUrl.searchParams.get("page") ?? "1") || 1;
  const result = await listSolicitations(eventId, { status, category, search }, page);
  return NextResponse.json(result);
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
