/**
 * One-time/reusable loader for a real "outreach" spreadsheet into the
 * Solicitation table. Built against Second Chance's actual multi-year
 * donation-solicitation workbook, whose "Outreach" sheet has this shape:
 * Company / Donated in <year>? (x4) / Solicitor for <year> (x3) /
 * Date Solicited-Followed Up / Status / Solicitation Committee Comments /
 * Received by Item Management / Item Received / Category / Email /
 * Contact person-Website-Facebook / Link / Mailing Address / City / State
 * / Zip / Phone.
 *
 * Deliberately takes the source file as a CLI argument rather than
 * embedding any real contact data in this script — the script is safe to
 * commit, the spreadsheet itself is not.
 *
 * Usage:
 *   npx tsx scripts/import-solicitations.ts <path-to-xlsx> <eventId> [sheetName]
 */
import ExcelJS from "exceljs";
import { PrismaClient, SolicitationStatus, SolicitationDeliveryMethod } from "@prisma/client";

const prisma = new PrismaClient();

// Real-world "Status" column values, mapped down to the app's status
// vocabulary. Anything not listed here falls back to CONTACTED if the
// company was reached at all, or PROSPECT if the status cell is blank —
// see classify() below.
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

function classify(rawStatus: string): SolicitationStatus {
  const key = rawStatus.trim().toLowerCase();
  if (!key) return SolicitationStatus.PROSPECT;
  if (key === "wine pull only") return SolicitationStatus.PROSPECT;
  return STATUS_MAP[key] ?? SolicitationStatus.CONTACTED;
}

function classifyDelivery(rawStatus: string): SolicitationDeliveryMethod | undefined {
  return DELIVERY_MAP[rawStatus.trim().toLowerCase()];
}

function findColumn(headers: string[], predicate: (normalized: string) => boolean): number {
  return headers.findIndex((h) => h && predicate(h.replace(/\s+/g, " ").trim().toLowerCase()));
}

async function main() {
  const [, , filePath, eventId, sheetNameArg] = process.argv;
  if (!filePath || !eventId) {
    console.error(
      "Usage: npx tsx scripts/import-solicitations.ts <path-to-xlsx> <eventId> [sheetName]",
    );
    process.exit(1);
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    console.error(`No event found with id ${eventId}`);
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = sheetNameArg
    ? workbook.getWorksheet(sheetNameArg)
    : workbook.worksheets.find((ws) => /outreach/i.test(ws.name)) ?? workbook.worksheets[0];
  if (!worksheet) {
    console.error("Could not find a worksheet to import.");
    process.exit(1);
  }
  console.log(`Reading sheet "${worksheet.name}" (${worksheet.rowCount} rows)`);

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
    console.error(`Could not find a "Company" column. Headers seen: ${headers.filter(Boolean).join(", ")}`);
    process.exit(1);
  }

  const rows: Array<{
    eventId: string;
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
  }> = [];

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
      eventId,
      contactName,
      contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      contactPhone: col.phone > -1 ? cellText(row.getCell(col.phone).value).trim() || undefined : undefined,
      category: col.category > -1 ? cellText(row.getCell(col.category).value).trim() || undefined : undefined,
      notes: notesParts.length ? notesParts.join(" — ") : undefined,
      status: classify(rawStatus),
      deliveryMethod: classifyDelivery(rawStatus),
      assignedTo: col.assignedTo > -1 ? cellText(row.getCell(col.assignedTo).value).trim() || undefined : undefined,
      lastContactedAt: col.lastContacted > -1 ? cellDate(row.getCell(col.lastContacted).value) : undefined,
      priorYearDonor: col.donatedPriorYear.some((i) =>
        /^y(es)?$/i.test(cellText(row.getCell(i).value).trim()),
      ),
    });
  });

  console.log(`Parsed ${rows.length} contacts (${skippedBlank} blank rows skipped).`);

  const BATCH = 500;
  let created = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const result = await prisma.solicitation.createMany({ data: batch });
    created += result.count;
    console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log(`Done. Created ${created} solicitation records under event ${eventId}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
