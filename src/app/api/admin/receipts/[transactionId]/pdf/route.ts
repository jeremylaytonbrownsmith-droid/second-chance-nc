import { NextRequest, NextResponse } from "next/server";
import { acknowledgmentFileName, generateAcknowledgmentPdf, ReceiptNotFoundError } from "@/lib/receipts/pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await params;
  try {
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
    console.error(error);
    return NextResponse.json({ error: "internal_error", message: "Something went wrong" }, { status: 500 });
  }
}
