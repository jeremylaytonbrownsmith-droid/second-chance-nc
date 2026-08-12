import { NextRequest, NextResponse } from "next/server";
import {
  constituentCsvColumns,
  createConstituent,
  listConstituents,
} from "@/lib/admin/constituents";
import { toCsv } from "@/lib/csv/to-csv";
import { toErrorResponse } from "@/lib/http/handle-error";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const orgId = request.nextUrl.searchParams.get("orgId");
  const search = request.nextUrl.searchParams.get("q") ?? undefined;

  if (!orgId) {
    return NextResponse.json(
      { error: "validation_error", message: "orgId is required" },
      { status: 400 },
    );
  }

  const constituents = await listConstituents(orgId, search);

  if (format === "csv") {
    return new NextResponse(toCsv(constituents, constituentCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="constituents.csv"',
      },
    });
  }

  return NextResponse.json({ constituents });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const constituent = await createConstituent(body);
    return NextResponse.json({ constituent }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
