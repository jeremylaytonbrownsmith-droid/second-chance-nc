import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";
import { generateYearEndStatementPdf, StatementNotFoundError } from "@/lib/statements/pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ constituentId: string }> },
) {
  try {
    await requireAdminRole(); // donor giving records are admin-only
    const { constituentId } = await params;
    const orgId = request.nextUrl.searchParams.get("orgId");
    const taxYearParam = request.nextUrl.searchParams.get("taxYear");
    if (!orgId || !taxYearParam) {
      return NextResponse.json(
        { error: "validation_error", message: "orgId and taxYear are required" },
        { status: 400 },
      );
    }
    const pdf = await generateYearEndStatementPdf(orgId, constituentId, Number(taxYearParam));
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="statement-${constituentId.slice(0, 8)}-${taxYearParam}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof StatementNotFoundError) {
      return NextResponse.json({ error: "not_found", message: error.message }, { status: 404 });
    }
    return toErrorResponse(error);
  }
}
