import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditedMutation } from "@/lib/audit";
import {
  calculateDeductibleCents,
  TRANSACTION_LINE_TYPES,
  type TransactionLineType,
} from "@/lib/money/deductible";
import { syncTransactionToEtapestry } from "@/lib/etapestry/demo-sync";

/**
 * Historical gift data import (Section 11's validation step: "load the
 * prior year's spreadsheet and reproduce that year's statements
 * exactly"). Every row is run through the same tested deductible engine
 * as live checkout — this file's only job is turning loose spreadsheet
 * columns into the same typed input that function already expects.
 */

export class SpreadsheetImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetImportError";
  }
}

// --- Parsing -----------------------------------------------------------

export type SpreadsheetFormat = "csv" | "xlsx";

export interface RawRow {
  rowNumber: number;
  values: Record<string, string>;
}

export async function parseSpreadsheet(
  buffer: Buffer,
  format: SpreadsheetFormat,
): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  if (format === "csv") {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    // exceljs bundles its own (older) @types/node transitively via
    // @fast-csv, whose Buffer type isn't structurally identical to the
    // generic Buffer<ArrayBufferLike> this project's @types/node now
    // produces — same runtime value, TS-only mismatch between two
    // differently-versioned Buffer type declarations.
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new SpreadsheetImportError("The file has no readable sheet.");
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: RawRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    let hasContent = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const raw = cell.value;
      const text =
        raw === null || raw === undefined
          ? ""
          : typeof raw === "object" && "text" in raw
            ? String((raw as { text: unknown }).text)
            : String(raw);
      if (text.trim() !== "") hasContent = true;
      values[header] = text.trim();
    });
    if (hasContent) rows.push({ rowNumber, values });
  });

  return rows;
}

// --- Header + value normalization ---------------------------------------

const HEADER_ALIASES: Record<string, string[]> = {
  donorName: ["donor name", "name", "donor"],
  donorEmail: ["donor email", "email"],
  lineType: ["line type", "type", "gift type"],
  amountDollars: ["amount", "amount paid", "paid", "amount ($)"],
  fmvDollars: ["fmv", "fair market value", "fmv ($)"],
  designation: ["designation", "fund", "notes"],
};

const LINE_TYPE_ALIASES: Record<string, TransactionLineType> = {
  "auction win": "AUCTION_WIN",
  auction: "AUCTION_WIN",
  raffle: "RAFFLE",
  "fund a need": "FUND_A_NEED",
  "fund-a-need": "FUND_A_NEED",
  fundaneed: "FUND_A_NEED",
  "cash gift": "CASH_GIFT",
  cash: "CASH_GIFT",
  ticket: "TICKET",
  sponsorship: "SPONSORSHIP",
  merch: "MERCH",
  merchandise: "MERCH",
};

function findHeaderValue(
  values: Record<string, string>,
  field: keyof typeof HEADER_ALIASES,
): string | undefined {
  const aliases = HEADER_ALIASES[field];
  for (const [header, value] of Object.entries(values)) {
    const normalized = header.trim().toLowerCase();
    if (aliases.includes(normalized)) return value;
  }
  return undefined;
}

function normalizeLineType(raw: string | undefined): TransactionLineType | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((TRANSACTION_LINE_TYPES as readonly string[]).includes(upper)) {
    return upper as TransactionLineType;
  }
  return LINE_TYPE_ALIASES[raw.trim().toLowerCase()];
}

function dollarsToCents(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return undefined;
  return Math.round(value * 100);
}

const importRowSchema = z
  .object({
    donorName: z.string().trim().optional(),
    donorEmail: z.string().trim().optional(),
    lineType: z.enum(TRANSACTION_LINE_TYPES, {
      message: "Unrecognized or missing line type",
    }),
    amountCents: z.number().int().positive({ message: "Amount must be a positive dollar value" }),
    fmvCents: z.number().int().min(0).optional(),
    designation: z.string().trim().optional(),
  })
  .refine((row) => (row.donorName?.length ?? 0) > 0 || (row.donorEmail?.length ?? 0) > 0, {
    message: "Row needs a donor name or email",
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export interface RowParseResult {
  rowNumber: number;
  ok: boolean;
  row?: ImportRow;
  error?: string;
}

export function normalizeRow(raw: RawRow): RowParseResult {
  const candidate = {
    donorName: findHeaderValue(raw.values, "donorName"),
    donorEmail: findHeaderValue(raw.values, "donorEmail"),
    lineType: normalizeLineType(findHeaderValue(raw.values, "lineType")),
    amountCents: dollarsToCents(findHeaderValue(raw.values, "amountDollars")),
    fmvCents: dollarsToCents(findHeaderValue(raw.values, "fmvDollars")),
    designation: findHeaderValue(raw.values, "designation") || undefined,
  };

  const parsed = importRowSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      rowNumber: raw.rowNumber,
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { rowNumber: raw.rowNumber, ok: true, row: parsed.data };
}

// --- Import --------------------------------------------------------------

export interface ImportRowOutcome {
  rowNumber: number;
  ok: boolean;
  error?: string;
  donorName?: string;
  amountCents?: number;
  deductibleCents?: number;
}

export interface ImportSummary {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  donorsCreated: number;
  totalAmountCents: number;
  totalDeductibleCents: number;
  outcomes: ImportRowOutcome[];
}

export async function importSpreadsheetRows(
  rawRows: RawRow[],
  input: { orgId: string; eventId: string; actorId: string },
): Promise<ImportSummary> {
  const outcomes: ImportRowOutcome[] = [];
  let donorsCreated = 0;
  let totalAmountCents = 0;
  let totalDeductibleCents = 0;

  for (const raw of rawRows) {
    const parsed = normalizeRow(raw);
    if (!parsed.ok || !parsed.row) {
      outcomes.push({ rowNumber: raw.rowNumber, ok: false, error: parsed.error });
      continue;
    }
    const row = parsed.row;

    try {
      const deductible = calculateDeductibleCents({
        lineType: row.lineType,
        amountCents: row.amountCents,
        fmvCents: row.fmvCents,
      });

      let constituent = row.donorEmail
        ? await prisma.constituent.findFirst({
            where: { orgId: input.orgId, email: row.donorEmail, voidedAt: null },
          })
        : null;

      if (!constituent && row.donorName) {
        const [firstName, ...rest] = row.donorName.split(" ");
        constituent = await prisma.constituent.findFirst({
          where: {
            orgId: input.orgId,
            firstName,
            lastName: rest.join(" ") || undefined,
            voidedAt: null,
          },
        });
      }

      if (!constituent) {
        const [firstName, ...rest] = (row.donorName ?? row.donorEmail ?? "Unknown").split(" ");
        constituent = await prisma.constituent.create({
          data: {
            orgId: input.orgId,
            firstName,
            lastName: rest.join(" ") || undefined,
            email: row.donorEmail || undefined,
          },
        });
        donorsCreated += 1;
      }

      const registration = await findOrCreateImportRegistration(
        input.eventId,
        constituent.id,
      );

      const transactionId = randomUUID();
      await auditedMutation({
        actorId: input.actorId,
        entityType: "Transaction",
        entityId: transactionId,
        action: "spreadsheet_import",
        before: async () => null,
        mutate: async (tx) => {
          const transaction = await tx.transaction.create({
            data: {
              id: transactionId,
              registrationId: registration.id,
              eventId: input.eventId,
              totalCents: row.amountCents,
              processor: "import",
              status: "PAID",
              paidAt: new Date(),
              method: "IN_KIND",
            },
          });
          await tx.transactionLine.create({
            data: {
              transactionId: transaction.id,
              lineType: row.lineType,
              amountCents: row.amountCents,
              fmvCents: deductible.fmvCents,
              deductibleCents: deductible.deductibleCents,
              designation: row.designation,
            },
          });
          return transaction;
        },
        after: async (_tx, result) => result,
      });

      // Best-effort, same as checkout: an imported gift is still a real
      // gift and should queue for the same donor CRM sync. A sync
      // failure must never fail the import row itself.
      syncTransactionToEtapestry(transactionId).catch((err) => {
        console.error("eTapestry sync failed for imported transaction", transactionId, err);
      });

      totalAmountCents += row.amountCents;
      totalDeductibleCents += deductible.deductibleCents;
      outcomes.push({
        rowNumber: raw.rowNumber,
        ok: true,
        donorName: row.donorName ?? row.donorEmail,
        amountCents: row.amountCents,
        deductibleCents: deductible.deductibleCents,
      });
    } catch (error) {
      outcomes.push({
        rowNumber: raw.rowNumber,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    totalRows: rawRows.length,
    importedRows: outcomes.filter((o) => o.ok).length,
    skippedRows: outcomes.filter((o) => !o.ok).length,
    donorsCreated,
    totalAmountCents,
    totalDeductibleCents,
    outcomes,
  };
}

/** Imported gifts still need a Registration to hang a Transaction off of
 * (Transaction is keyed by registration, not constituent, elsewhere in the
 * schema) — reuse one per constituent per event rather than minting a new
 * bidder number for historical, non-event-attendance gifts. */
async function findOrCreateImportRegistration(eventId: string, constituentId: string) {
  const existing = await prisma.registration.findFirst({
    where: { eventId, constituentId, voidedAt: null },
  });
  if (existing) return existing;

  const maxBidder = await prisma.registration.aggregate({
    where: { eventId },
    _max: { bidderNumber: true },
  });
  const nextBidderNumber = (maxBidder._max.bidderNumber ?? 0) + 1;

  return prisma.registration.create({
    data: { eventId, constituentId, bidderNumber: nextBidderNumber },
  });
}
