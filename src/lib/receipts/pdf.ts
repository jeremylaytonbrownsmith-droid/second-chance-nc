import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getTransactionForReceipt } from "@/lib/checkout/checkout";

/**
 * Renders the same acknowledgment content shown at
 * /admin/receipts/[transactionId] as a real, downloadable PDF — the
 * document a donor can actually keep for their records. This is the
 * org-to-donor written acknowledgment (Section 5, rule 3), not an IRS
 * form; nothing here touches Form 8283/8282, which stays manual pending
 * accountant sign-off per CLAUDE.md.
 */

const LINE_TYPE_LABELS: Record<string, string> = {
  AUCTION_WIN: "Auction item",
  RAFFLE: "Raffle tickets",
  FUND_A_NEED: "Fund a need",
  CASH_GIFT: "Cash gift",
  TICKET: "Event ticket",
  SPONSORSHIP: "Sponsorship",
  MERCH: "Merchandise",
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;

export class ReceiptNotFoundError extends Error {
  constructor(transactionId: string) {
    super(`No transaction found for id ${transactionId}`);
    this.name = "ReceiptNotFoundError";
  }
}

export async function generateAcknowledgmentPdf(transactionId: string): Promise<Uint8Array> {
  const receipt = await getTransactionForReceipt(transactionId);
  if (!receipt) throw new ReceiptNotFoundError(transactionId);

  const { transaction, quidProQuoDisclosureRequired, writtenAcknowledgmentRequired, totalDeductibleCents } =
    receipt;
  const donor = transaction.registration.constituent;
  const donorName = donor.isBusiness
    ? (donor.orgName ?? "")
    : `${donor.firstName ?? ""} ${donor.lastName ?? ""}`.trim();
  const org = transaction.event.organization;

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

  if (transaction.event.isDemo) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: contentWidth,
      height: 20,
      color: rgb(1, 0.95, 0.6),
    });
    draw("DEMO MODE — this document is a sample, not a real tax receipt", {
      size: 9,
      useFont: bold,
      gap: 16,
    });
  }

  draw(org.name, { size: 16, useFont: bold, gap: 4 });
  draw(transaction.event.name, { size: 10, color: rgb(0.4, 0.4, 0.4), gap: 2 });
  if (org.ein) {
    draw(`EIN ${org.ein}`, { size: 9, color: rgb(0.4, 0.4, 0.4), gap: 14 });
  } else {
    y -= 8;
  }

  draw("Written Acknowledgment of Contribution", { size: 13, useFont: bold, gap: 12 });
  draw(`Donor: ${donorName || "(name not on file)"}`, { size: 10, gap: 4 });
  draw(`Date: ${transaction.paidAt?.toISOString().slice(0, 10) ?? "—"}`, {
    size: 10,
    gap: 16,
  });

  const columns = [
    { label: "Item", x: MARGIN, width: 220 },
    { label: "Paid", x: MARGIN + 220, width: 100 },
    { label: "FMV", x: MARGIN + 320, width: 100 },
    { label: "Deductible", x: MARGIN + 420, width: 76 },
  ];

  const drawRow = (
    cells: string[],
    opts: { useFont?: PDFFont; size?: number } = {},
  ) => {
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
  drawRow(["Item", "Paid", "FMV", "Deductible"], { useFont: bold });
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: MARGIN + contentWidth, y: y + 6 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });

  for (const line of transaction.lines) {
    drawRow([
      LINE_TYPE_LABELS[line.lineType] ?? line.lineType,
      money(line.amountCents),
      money(line.fmvCents),
      money(line.deductibleCents),
    ]);
  }

  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: MARGIN + contentWidth, y: y + 6 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 4;
  drawRow(["Total", money(transaction.totalCents), "", money(totalDeductibleCents)], {
    useFont: bold,
  });
  y -= 12;

  if (quidProQuoDisclosureRequired) {
    drawWrapped(
      "Quid pro quo disclosure: In exchange for your contribution, you received goods or " +
        "services with an estimated fair market value shown above. Only the amount in excess " +
        "of that fair market value is deductible as a charitable contribution, as reflected in " +
        "the Deductible column.",
    );
    y -= 6;
  }
  if (writtenAcknowledgmentRequired) {
    drawWrapped(
      "This letter serves as your contemporaneous written acknowledgment for tax purposes. No " +
        "goods or services were provided in exchange for the deductible portion of your " +
        "contribution beyond what is described above.",
    );
    y -= 6;
  }

  drawWrapped(
    "Please retain this document for your tax records. Consult your tax advisor regarding the " +
      "deductibility of your contribution.",
    { size: 8 },
  );

  return doc.save();
}

export function acknowledgmentFileName(transactionId: string): string {
  return `acknowledgment-${transactionId.slice(0, 8)}.pdf`;
}
