import { NextRequest, NextResponse } from "next/server";
import {
  importSolicitationRows,
  parseSolicitationWorkbook,
  SolicitationImportError,
} from "@/lib/import/solicitation-spreadsheet";
import { toErrorResponse } from "@/lib/http/handle-error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId");
    const sheetName = formData.get("sheetName");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "validation_error", message: "file is required" },
        { status: 400 },
      );
    }
    if (typeof eventId !== "string" || !eventId) {
      return NextResponse.json(
        { error: "validation_error", message: "eventId is required" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { sheetName: parsedSheetName, rows, skippedBlank } = await parseSolicitationWorkbook(
      buffer,
      typeof sheetName === "string" && sheetName ? sheetName : undefined,
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "validation_error", message: "No contact rows found in the file" },
        { status: 400 },
      );
    }
    if (rows.length > 10_000) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: `File has ${rows.length} rows — import in batches of 10,000 or fewer for now.`,
        },
        { status: 400 },
      );
    }

    const { created, updated } = await importSolicitationRows(eventId, rows);
    return NextResponse.json({
      sheetName: parsedSheetName,
      totalRows: rows.length,
      skippedBlank,
      created,
      updated,
    });
  } catch (error) {
    if (error instanceof SolicitationImportError) {
      return NextResponse.json({ error: "import_error", message: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
