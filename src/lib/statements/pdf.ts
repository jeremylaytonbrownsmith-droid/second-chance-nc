import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getDonorYearEndStatement, LINE_TYPE_LABELS } from "./year-end";
import { TRANSACTION_LINE_TYPES } from "@/lib/money/deductible";

/**
 * Year-end statement PDF — one donor, one organization, one tax year,
 * combining every line type they gave across every event that org ran
 * that year. Same pdf-lib layout approach as src/lib/receipts/pdf.ts;
 * this is a summary across the whole year, that one is a single
 * transaction's acknowledgment, so they're separate documents rather
 * than variations of one function.
 */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56;

export class StatementNotFoundError extends Error {
  constructor(constituentId: string, taxYear: number) {
    super(`No giving found for constituent ${constituentId} in tax year ${taxYear}`);
    this.name = "StatementNotFoundError";
  }
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function generateYearEndStatementPdf(
  orgId: string,
  constituentId: string,
  taxYear: number,
): Promise<Uint8Array> {
  const statement = await getDonorYearEndStatement(orgId, constituentId, taxYear);
  if (!statement) throw new StatementNotFoundError(constituentId, taxYear);

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  const draw = (
    text: string,
    opts: { size?: number; useFont?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    page.drawText(text, {
      x: MARGIN,
      y,
      size,
      font: opts.useFont ?? font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
    y -= size + (opts.gap ?? 6);
  };

  const drawWrapped = (text: string, opts: { size?: number; useFont?: PDFFont } = {}) => {
    const size = opts.size ?? 9;
    const activeFont = opts.useFont ?? font;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (activeFont.widthOfTextAtSize(candidate, size) > contentWidth && line) {
        draw(line, { size, useFont: activeFont, gap: 3 });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) draw(line, { size, useFont: activeFont, gap: 3 });
  };

  draw(statement.orgName, { size: 16, useFont: bold, gap: 4 });
  if (statement.orgEin) {
    draw(`EIN ${statement.orgEin}`, { size: 9, color: rgb(0.4, 0.4, 0.4), gap: 14 });
  } else {
    y -= 8;
  }

  draw(`${statement.taxYear} Year-End Giving Statement`, { size: 13, useFont: bold, gap: 12 });
  draw(`Donor: ${statement.donorName || "(name not on file)"}`, { size: 10, gap: 16 });

  const columns = [
    { label: "Category", x: MARGIN, width: 300 },
    { label: "Paid", x: MARGIN + 300, width: 140 },
    { label: "Deductible", x: MARGIN + 440, width: 76 },
  ];
  const drawRow = (cells: string[], opts: { useFont?: PDFFont; size?: number } = {}) => {
    const size = opts.size ?? 9.5;
    const rowFont = opts.useFont ?? font;
    columns.forEach((col, i) => {
      const text = cells[i] ?? "";
      const textWidth = rowFont.widthOfTextAtSize(text, size);
      const x = i === 0 ? col.x : col.x + col.width - textWidth;
      page.drawText(text, { x, y, size, font: rowFont, color: rgb(0.1, 0.1, 0.1) });
    });
    y -= size + 8;
  };

  page.drawLine({
    start: { x: MARGIN, y: y + 4 },
    end: { x: MARGIN + contentWidth, y: y + 4 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 4;
  drawRow(["Category", "Paid", "Deductible"], { useFont: bold });
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: MARGIN + contentWidth, y: y + 6 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });

  for (const type of TRANSACTION_LINE_TYPES) {
    const bucket = statement.byLineType[type];
    if (bucket.amountCents === 0) continue;
    drawRow([LINE_TYPE_LABELS[type], money(bucket.amountCents), money(bucket.deductibleCents)]);
  }

  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: MARGIN + contentWidth, y: y + 6 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 4;
  drawRow(["Total", money(statement.totalAmountCents), money(statement.totalDeductibleCents)], {
    useFont: bold,
  });
  y -= 16;

  drawWrapped(
    "This statement combines every gift and purchase recorded for you across all of this " +
      `organization's events in ${statement.taxYear}. Where goods or services were received in ` +
      "return (auction items, event tickets, sponsorship benefits), only the amount paid in " +
      "excess of their fair market value is reflected in the Deductible column, per the quid pro " +
      "quo rules applied at the time of each gift.",
  );
  y -= 6;
  drawWrapped(
    "Please retain this document for your tax records. Consult your tax advisor regarding the " +
      "deductibility of your contributions.",
    { size: 8 },
  );

  return doc.save();
}
