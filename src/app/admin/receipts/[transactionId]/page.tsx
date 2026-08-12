import { notFound } from "next/navigation";
import { getTransactionForReceipt } from "@/lib/checkout/checkout";

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

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const receipt = await getTransactionForReceipt(transactionId);
  if (!receipt) notFound();

  const { transaction, quidProQuoDisclosureRequired, writtenAcknowledgmentRequired, totalDeductibleCents } =
    receipt;
  const donorName = transaction.registration.constituent.isBusiness
    ? transaction.registration.constituent.orgName
    : `${transaction.registration.constituent.firstName ?? ""} ${transaction.registration.constituent.lastName ?? ""}`.trim();

  return (
    <div className="mx-auto max-w-xl">
      {transaction.event.isDemo && (
        <div className="mb-4 rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900 print:hidden">
          DEMO MODE — this receipt is not a real tax document
        </div>
      )}

      <div className="rounded border border-brand-lavender bg-white p-4 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold">{transaction.event.organization.name}</h1>
          <p className="text-sm text-neutral-500">{transaction.event.name}</p>
          <p className="mt-2 text-xs text-neutral-500">
            Receipt for {donorName} — {transaction.paidAt?.toISOString().slice(0, 10)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Paid</th>
                <th className="py-1 text-right">FMV</th>
                <th className="py-1 text-right">Deductible</th>
              </tr>
            </thead>
            <tbody>
              {transaction.lines.map((line) => (
                <tr key={line.id} className="border-b border-neutral-100">
                  <td className="py-1">{LINE_TYPE_LABELS[line.lineType] ?? line.lineType}</td>
                  <td className="py-1 text-right">{money(line.amountCents)}</td>
                  <td className="py-1 text-right">{money(line.fmvCents)}</td>
                  <td className="py-1 text-right">{money(line.deductibleCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right">{money(transaction.totalCents)}</td>
                <td></td>
                <td className="pt-2 text-right">{money(totalDeductibleCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {quidProQuoDisclosureRequired && (
          <p className="mt-6 rounded bg-neutral-100 p-3 text-xs text-neutral-700">
            <strong>Quid pro quo disclosure:</strong> In exchange for your contribution, you
            received goods or services with an estimated fair market value shown above. Only
            the amount in excess of that fair market value is deductible as a charitable
            contribution, as reflected in the Deductible column.
          </p>
        )}
        {writtenAcknowledgmentRequired && (
          <p className="mt-2 text-xs text-neutral-700">
            This letter serves as your contemporaneous written acknowledgment for tax
            purposes. No goods or services were provided in exchange for the deductible
            portion of your contribution beyond what is described above.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">
          {transaction.event.organization.name}
          {transaction.event.organization.ein ? ` · EIN ${transaction.event.organization.ein}` : ""}
        </p>
      </div>
    </div>
  );
}
