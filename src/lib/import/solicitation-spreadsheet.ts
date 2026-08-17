import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { SolicitationStatus, SolicitationDeliveryMethod } from "@prisma/client";

/**
 * Shared parser for a real "outreach" spreadsheet shape (verified against
 * the organization's own multi-year donation-solicitation workbook), used
 * by both the CLI script (scripts/import-solicitations.ts) and the admin
 * upload route (/api/admin/solicitations/import). Expected columns:
 * Company / Donated in <year>? (x4) / Solicitor for <year> (x3) /
 * Date Solicited-Followed Up / Status / Solicitation Committee Comments /
 * Received by Item Management / Item Received / Category / Email /
 * Contact person-Website-Facebook / Link / Mailing Address / City / State
 * / Zip / Phone.
 */

// Real-world "Status" column values, mapped down to the app's status
// vocabulary. Anything not listed here falls back to CONTACTED if the
// company was reached at all, or PROSPECT if the status cell is blank —
// see classifyStatus() below.
const STATUS_MAP: Record<string, SolicitationStatus> = {
  "reminder sent": SolicitationStatus.CONTACTED,
  emailed: SolicitationStatus.CONTACTED,
  "submitted online form": SolicitationStatus.CONTACTED,
  "dropped off letter/flyer": SolicitationStatus.CONTACTED,
  "go in person": SolicitationStatus.CONTACTED,
  "reach out early": SolicitationStatus.CONTACTED,
  "need additional info - see comments": SolicitationStatus.CONTACTED,
  "email bounced back": SolicitationStatus.CONTACTED,
  "will donate - will mail": SolicitationStatus.COMMITTED,
  "will donate - needs pick up": SolicitationStatus.COMMITTED,
  "will donate - email": SolicitationStatus.COMMITTED,
  received: SolicitationStatus.DONATED,
  "received - sc to make gc": SolicitationStatus.DONATED,
  "declined - see comments": SolicitationStatus.DECLINED,
  "business closed": SolicitationStatus.DECLINED,
  "do not contact - see notes": SolicitationStatus.DO_NOT_CONTACT,
};

const DELIVERY_MAP: Record<string, SolicitationDeliveryMethod> = {
  "will donate - will mail": SolicitationDeliveryMethod.MAIL,
  "will donate - needs pick up": SolicitationDeliveryMethod.PICKUP,
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value) {
      const t = (value as { text: unknown }).text;
      if (typeof t === "string") return t;
      if (t && typeof t === "object" && "richText" in t) {
        return (t as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
      }
      return t ? String(t) : "";
    }
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
    return "";
  }
  return String(value).trim();
}

function cellDate(value: ExcelJS.CellValue): Date | undefined {
  if (value instanceof Date) return value;
  const text = cellText(value).trim();
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function classifyStatus(rawStatus: string): SolicitationStatus {
  const key = rawStatus.trim().toLowerCase();
  if (!key) return SolicitationStatus.PROSPECT;
  if (key === "wine pull only") return SolicitationStatus.PROSPECT;
  return STATUS_MAP[key] ?? SolicitationStatus.CONTACTED;
}

export function classifyDelivery(rawStatus: string): SolicitationDeliveryMethod | undefined {
  return DELIVERY_MAP[rawStatus.trim().toLowerCase()];
}

function findColumn(headers: string[], predicate: (normalized: string) => boolean): number {
  return headers.findIndex((h) => h && predicate(h.replace(/\s+/g, " ").trim().toLowerCase()));
}

export interface ParsedSolicitationRow {
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  category?: string;
  notes?: string;
  status: SolicitationStatus;
  deliveryMethod?: SolicitationDeliveryMethod;
  assignedTo?: string;
  lastContactedAt?: Date;
  priorYearDonor: boolean;
}

export class SolicitationImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolicitationImportError";
  }
}

export interface ParseResult {
  sheetName: string;
  rows: ParsedSolicitationRow[];
  skippedBlank: number;
}

/** Parses an uploaded workbook buffer into rows ready to import. Picks the
 * sheet whose name contains "outreach" (case-insensitive) unless a name is
 * given explicitly, falling back to the first sheet. */
export async function parseSolicitationWorkbook(
  buffer: Buffer,
  sheetName?: string,
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : (workbook.worksheets.find((ws) => /outreach/i.test(ws.name)) ?? workbook.worksheets[0]);
  if (!worksheet) {
    throw new SolicitationImportError("Could not find a worksheet to import.");
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).replace(/\n/g, " ");
  });

  const col = {
    company: findColumn(headers, (h) => h === "company"),
    email: findColumn(headers, (h) => h === "email"),
    phone: findColumn(headers, (h) => h === "phone"),
    category: findColumn(headers, (h) => h === "category"),
    status: findColumn(headers, (h) => h === "status"),
    assignedTo: findColumn(headers, (h) => h.startsWith("solictor for") || h.startsWith("solicitor for")),
    lastContacted: findColumn(headers, (h) => h.startsWith("date solicited")),
    committeeComments: findColumn(headers, (h) => h === "solicitation committee comments"),
    receivedByItemMgmt: findColumn(headers, (h) => h === "received by item management"),
    itemReceived: findColumn(headers, (h) => h === "item received"),
    donatedPriorYear: headers
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h && /^donated in \d{4}\?$/i.test(h.trim()))
      .map(({ i }) => i),
  };

  if (col.company === -1) {
    throw new SolicitationImportError(
      `Could not find a "Company" column. Headers seen: ${headers.filter(Boolean).join(", ")}`,
    );
  }

  const rows: ParsedSolicitationRow[] = [];
  let skippedBlank = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const contactName = cellText(row.getCell(col.company).value).trim();
    if (!contactName) {
      skippedBlank++;
      return;
    }

    const rawStatus = col.status > -1 ? cellText(row.getCell(col.status).value) : "";
    const email = col.email > -1 ? cellText(row.getCell(col.email).value).trim() : "";
    const notesParts = [col.committeeComments, col.receivedByItemMgmt, col.itemReceived]
      .filter((i) => i > -1)
      .map((i) => cellText(row.getCell(i).value).trim())
      .filter(Boolean);

    rows.push({
      contactName,
      contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      contactPhone: col.phone > -1 ? cellText(row.getCell(col.phone).value).trim() || undefined : undefined,
      category: col.category > -1 ? cellText(row.getCell(col.category).value).trim() || undefined : undefined,
      notes: notesParts.length ? notesParts.join(" — ") : undefined,
      status: classifyStatus(rawStatus),
      deliveryMethod: classifyDelivery(rawStatus),
      assignedTo: col.assignedTo > -1 ? cellText(row.getCell(col.assignedTo).value).trim() || undefined : undefined,
      lastContactedAt: col.lastContacted > -1 ? cellDate(row.getCell(col.lastContacted).value) : undefined,
      priorYearDonor: col.donatedPriorYear.some((i) =>
        /^y(es)?$/i.test(cellText(row.getCell(i).value).trim()),
      ),
    });
  });

  return { sheetName: worksheet.name, rows, skippedBlank };
}

export interface ImportSolicitationsSummary {
  sheetName: string;
  totalRows: number;
  skippedBlank: number;
  created: number;
  updated: number;
}

const CONCURRENCY = 25;

/** Loads parsed rows into the database, one Solicitation per contact per
 * event. Re-running against the same event is safe: a row whose
 * contactName already exists (case-insensitively) for that event is
 * updated in place rather than duplicated, so uploading an updated
 * version of the same spreadsheet next month — or next year — doesn't
 * pile up duplicate contacts. */
export async function importSolicitationRows(
  eventId: string,
  rows: ParsedSolicitationRow[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => {
        const existing = await prisma.solicitation.findFirst({
          where: { eventId, voidedAt: null, contactName: { equals: row.contactName, mode: "insensitive" } },
        });
        if (existing) {
          await prisma.solicitation.update({ where: { id: existing.id }, data: row });
          return "updated" as const;
        }
        await prisma.solicitation.create({ data: { eventId, ...row } });
        return "created" as const;
      }),
    );
    created += results.filter((r) => r === "created").length;
    updated += results.filter((r) => r === "updated").length;
  }

  return { created, updated };
}
