import { NextRequest, NextResponse } from "next/server";
import {
  importSpreadsheetRows,
  parseSpreadsheet,
  SpreadsheetImportError,
  type SpreadsheetFormat,
} from "@/lib/import/spreadsheet-import";
import { toErrorResponse } from "@/lib/http/handle-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId");
    const orgId = formData.get("orgId");
    const actorId = formData.get("actorId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "validation_error", message: "file is required" },
        { status: 400 },
      );
    }
    if (typeof eventId !== "string" || typeof orgId !== "string" || typeof actorId !== "string" || !actorId.trim()) {
      return NextResponse.json(
        { error: "validation_error", message: "eventId, orgId, and actorId are required" },
        { status: 400 },
      );
    }

    const format: SpreadsheetFormat = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseSpreadsheet(buffer, format);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "validation_error", message: "No data rows found in the file" },
        { status: 400 },
      );
    }
    if (rows.length > 2000) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: `File has ${rows.length} rows — import in batches of 2000 or fewer for now.`,
        },
        { status: 400 },
      );
    }

    const summary = await importSpreadsheetRows(rows, { orgId, eventId, actorId });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof SpreadsheetImportError) {
      return NextResponse.json(
        { error: "import_error", message: error.message },
        { status: 400 },
      );
    }
    return toErrorResponse(error);
  }
}
