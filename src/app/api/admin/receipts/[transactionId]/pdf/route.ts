import { NextRequest, NextResponse } from "next/server";
import { acknowledgmentFileName, generateAcknowledgmentPdf, ReceiptNotFoundError } from "@/lib/receipts/pdf";
import { toErrorResponse } from "@/lib/http/handle-error";
import { requireAdminRole } from "@/lib/admin/session";

/**
 * Admin-side lookup of any donor's receipt PDF — unlike the guest-facing
 * mirror at /api/receipts/[transactionId]/pdf (intentionally open, same
 * as a guest's own bidder view), this one lets staff pull up ANY
 * transaction's receipt by id, so it needs its own explicit admin check
 * rather than relying solely on the shared proxy gate (src/proxy.ts),
 * matching every other /api/admin/* route.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  try {
    await requireAdminRole();
    const { transactionId } = await params;
    const pdfBytes = await generateAcknowledgmentPdf(transactionId);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${acknowledgmentFileName(transactionId)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ReceiptNotFoundError) {
      return NextResponse.json({ error: "not_found", message: error.message }, { status: 404 });
    }
    return toErrorResponse(error);
  }
}
