import { getTransactionForReceipt } from "@/lib/checkout/checkout";
import { generateAcknowledgmentPdf } from "@/lib/receipts/pdf";
import { getEmailAdapter } from "@/lib/email";

/**
 * Emails the donor their receipt right after checkout — the quid pro quo
 * disclosure, FMV, and deductible amount shown here are exactly what
 * already renders at /receipts/[transactionId] and the downloadable PDF
 * (src/lib/receipts/pdf.ts); this module only adds delivery, it doesn't
 * author any new tax copy. Best-effort and resilient by design, matching
 * syncTransactionToEtapestry's pattern in checkout.ts: a send failure (no
 * donor email on file, the provider being down, anything) must never
 * throw into the checkout flow that already completed and got paid.
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

function siteUrl(): string {
  return process.env.SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function sendReceiptEmail(transactionId: string): Promise<void> {
  const receipt = await getTransactionForReceipt(transactionId);
  if (!receipt) {
    console.error("sendReceiptEmail: no transaction found for", transactionId);
    return;
  }

  const { transaction, quidProQuoDisclosureRequired, writtenAcknowledgmentRequired, totalDeductibleCents } =
    receipt;
  const donor = transaction.registration.constituent;
  const donorEmail = donor.email?.trim();
  if (!donorEmail) {
    // No email on file — nothing to send to. Not an error; plenty of
    // cash/walk-up bidders never give one.
    return;
  }
  const donorName = donor.isBusiness
    ? (donor.orgName ?? "")
    : `${donor.firstName ?? ""} ${donor.lastName ?? ""}`.trim();
  const org = transaction.event.organization;
  const receiptUrl = `${siteUrl()}/receipts/${transaction.id}`;

  const rowsHtml = transaction.lines
    .map(
      (line) => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${LINE_TYPE_LABELS[line.lineType] ?? line.lineType}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${money(line.amountCents)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${money(line.fmvCents)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${money(line.deductibleCents)}</td>
      </tr>`,
    )
    .join("");

  const disclosureHtml = quidProQuoDisclosureRequired
    ? `<p style="font-size:12px;color:#444;background:#f3f0fa;padding:10px;border-radius:8px;">
        <strong>Quid pro quo disclosure:</strong> In exchange for your contribution, you received
        goods or services with an estimated fair market value shown above. Only the amount in
        excess of that fair market value is deductible as a charitable contribution, as reflected
        in the Deductible column.
      </p>`
    : "";
  const acknowledgmentHtml = writtenAcknowledgmentRequired
    ? `<p style="font-size:12px;color:#444;">
        This email serves as your contemporaneous written acknowledgment for tax purposes. No
        goods or services were provided in exchange for the deductible portion of your
        contribution beyond what is described above.
      </p>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#5b3a9b;">${org.name}</h2>
      <p style="color:#666;font-size:13px;">${transaction.event.name}</p>
      <p style="font-size:13px;">Thank you, ${donorName || "friend"} — here's your receipt.</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;border-bottom:2px solid #ccc;">
            <th style="padding:4px 8px;">Item</th>
            <th style="padding:4px 8px;text-align:right;">Paid</th>
            <th style="padding:4px 8px;text-align:right;">FMV</th>
            <th style="padding:4px 8px;text-align:right;">Deductible</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="font-weight:bold;">
            <td style="padding:4px 8px;">Total</td>
            <td style="padding:4px 8px;text-align:right;">${money(transaction.totalCents)}</td>
            <td></td>
            <td style="padding:4px 8px;text-align:right;">${money(totalDeductibleCents)}</td>
          </tr>
        </tfoot>
      </table>
      ${disclosureHtml}
      ${acknowledgmentHtml}
      <p style="font-size:12px;"><a href="${receiptUrl}">View this receipt online</a> — a PDF copy is attached.</p>
      <p style="font-size:11px;color:#999;">${org.name}${org.ein ? ` · EIN ${org.ein}` : ""}</p>
    </div>
  `;

  const text = `Thank you, ${donorName || "friend"} — your receipt from ${org.name} (${transaction.event.name}).
Total paid: ${money(transaction.totalCents)}. Deductible: ${money(totalDeductibleCents)}.
View online: ${receiptUrl}`;

  try {
    const pdf = await generateAcknowledgmentPdf(transaction.id);
    const result = await getEmailAdapter().sendEmail({
      to: donorEmail,
      subject: `Your receipt from ${org.name}`,
      html,
      text,
      attachments: [{ filename: `receipt-${transaction.id.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
    if (!result.ok) {
      console.error("sendReceiptEmail: provider rejected send for", transaction.id, result.error);
    }
  } catch (error) {
    console.error("sendReceiptEmail: failed for", transaction.id, error);
  }
}
