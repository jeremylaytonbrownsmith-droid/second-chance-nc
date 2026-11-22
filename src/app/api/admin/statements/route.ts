import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/csv/to-csv";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";
import { donorYearEndStatementCsvColumns, listDonorYearEndStatementsForOrg } from "@/lib/statements/year-end";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(); // donor giving records are admin-only
    const orgId = request.nextUrl.searchParams.get("orgId");
    const taxYearParam = request.nextUrl.searchParams.get("taxYear");
    const format = request.nextUrl.searchParams.get("format");

    if (!orgId || !taxYearParam) {
      return NextResponse.json(
        { error: "validation_error", message: "orgId and taxYear are required" },
        { status: 400 },
      );
    }
    const taxYear = Number(taxYearParam);
    const statements = await listDonorYearEndStatementsForOrg(orgId, taxYear);

    if (format === "csv") {
      return new NextResponse(toCsv(statements, donorYearEndStatementCsvColumns), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="year-end-statements-${taxYear}.csv"`,
        },
      });
    }

    return NextResponse.json({ statements });
  } catch (error) {
    return toErrorResponse(error);
  }
}
