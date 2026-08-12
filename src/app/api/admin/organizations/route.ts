import { NextRequest, NextResponse } from "next/server";
import {
  createOrganization,
  listOrganizations,
  organizationCsvColumns,
} from "@/lib/admin/organizations";
import { toCsv } from "@/lib/csv/to-csv";
import { toErrorResponse } from "@/lib/http/handle-error";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const organizations = await listOrganizations();

  if (format === "csv") {
    return new NextResponse(toCsv(organizations, organizationCsvColumns), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="organizations.csv"',
      },
    });
  }

  return NextResponse.json({ organizations });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const organization = await createOrganization(body);
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
