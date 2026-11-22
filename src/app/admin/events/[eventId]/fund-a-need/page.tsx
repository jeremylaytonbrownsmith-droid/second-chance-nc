import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffRole } from "@/lib/admin/session";
import { AdminOnlyNotice } from "../../../AdminOnlyNotice";
import { card, table } from "../../../ui";
import { listFundANeedGifts, getFundANeedTotalCents } from "@/lib/auction/fund-a-need";
import { FundANeedClerkForm } from "./FundANeedClerkForm";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function FundANeedClerkPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if ((await getStaffRole()) !== "admin") return <AdminOnlyNotice />;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [registrations, gifts, totalCents] = await Promise.all([
    prisma.registration.findMany({
      where: { eventId, voidedAt: null, status: "CHECKED_IN" },
      include: { constituent: true },
      orderBy: { bidderNumber: "asc" },
    }),
    listFundANeedGifts(eventId),
    getFundANeedTotalCents(eventId),
  ]);

  return (
    <div className="space-y-4">
      {event.isDemo && (
        <div className="rounded bg-yellow-200 px-3 py-2 text-center text-sm font-semibold text-yellow-900">
          DEMO MODE — payments are simulated, no real charge occurs
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold">Fund a Need — {event.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick the giving level the room is on, tap every paddle that just went up
          at that level, and submit — each paddle becomes its own gift, charged to
          the card on file, same as a regular checkout.
        </p>
      </div>

      <div className={card}>
        <span className="text-sm text-neutral-500">Raised so far</span>
        <div className="text-2xl font-bold text-brand-purple">{money(totalCents)}</div>
      </div>

      <FundANeedClerkForm
        eventId={eventId}
        registrations={registrations.map((r) => ({
          id: r.id,
          bidderNumber: r.bidderNumber,
          name: r.constituent.isBusiness
            ? (r.constituent.orgName ?? "")
            : `${r.constituent.firstName ?? ""} ${r.constituent.lastName ?? ""}`.trim(),
        }))}
      />

      <div>
        <h2 className="mb-2 font-semibold">Gifts recorded</h2>
        <div className={table.wrapper}>
          <table className={table.table}>
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}>Paddle</th>
                <th className={table.th}>Donor</th>
                <th className={table.th}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {gifts.length === 0 ? (
                <tr>
                  <td className={table.empty} colSpan={3}>
                    None yet.
                  </td>
                </tr>
              ) : (
                gifts.map((g) => (
                  <tr key={g.transactionId} className={table.row}>
                    <td className={table.td}>#{g.bidderNumber}</td>
                    <td className={table.td}>{g.donorName}</td>
                    <td className={table.td}>{money(g.amountCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
