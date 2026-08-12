import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listConstituents } from "@/lib/admin/constituents";
import { listItemDonors } from "@/lib/admin/item-donors";
import { listAuctionItems } from "@/lib/admin/auction-items";
import {
  closeAuctionItemAction,
  createAuctionItemAction,
  createConstituentAction,
  createItemDonorAction,
  openAuctionItemAction,
  setAuctionItemFmvAction,
} from "../../actions";

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [constituents, itemDonors, auctionItems] = await Promise.all([
    listConstituents(event.orgId),
    listItemDonors(eventId),
    listAuctionItems(eventId),
  ]);

  const constituentName = (id: string) => {
    const c = constituents.find((c) => c.id === id);
    if (!c) return id;
    return c.isBusiness
      ? (c.orgName ?? id)
      : [c.firstName, c.lastName].filter(Boolean).join(" ") || id;
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-neutral-500">
          {event.eventDate.toISOString().slice(0, 10)} · Tax year{" "}
          {event.taxYear} · {event.status}
        </p>
      </div>

      {/* Auction items */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Item catalog</h2>
          <a
            className="text-sm text-brand-purple underline"
            href={`/api/admin/auction-items?eventId=${eventId}&format=csv`}
          >
            Export CSV
          </a>
        </div>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">FMV</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {auctionItems.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100 align-top">
                <td className="py-2 pr-4">{item.itemNumber}</td>
                <td className="py-2 pr-4">{item.title}</td>
                <td className="py-2 pr-4">{item.itemType}</td>
                <td className="py-2 pr-4">{formatCents(item.fmvCents)}</td>
                <td className="py-2 pr-4">{item.status}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-col gap-2">
                    {item.fmvCents === null && (
                      <form
                        action={setAuctionItemFmvAction}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          name="fmvDollars"
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="FMV $"
                          required
                          className="w-20 rounded border border-neutral-300 px-1 py-0.5"
                        />
                        <input
                          name="fmvBasis"
                          placeholder="basis"
                          required
                          className="w-28 rounded border border-neutral-300 px-1 py-0.5"
                        />
                        <input
                          name="actorId"
                          placeholder="your name"
                          required
                          className="w-24 rounded border border-neutral-300 px-1 py-0.5"
                        />
                        <button className="rounded bg-brand-purple px-2 py-0.5 text-white">
                          Set FMV
                        </button>
                      </form>
                    )}
                    {item.fmvCents !== null && item.status === "DRAFT" && (
                      <form action={openAuctionItemAction} className="flex items-center gap-1">
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          name="actorId"
                          placeholder="your name"
                          required
                          className="w-24 rounded border border-neutral-300 px-1 py-0.5"
                        />
                        <button className="rounded bg-brand-purple px-2 py-0.5 text-white">
                          Open
                        </button>
                      </form>
                    )}
                    {item.status === "OPEN" && (
                      <form action={closeAuctionItemAction} className="flex items-center gap-1">
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          name="actorId"
                          placeholder="your name"
                          required
                          className="w-24 rounded border border-neutral-300 px-1 py-0.5"
                        />
                        <button className="rounded bg-brand-purple px-2 py-0.5 text-white">
                          Close
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {auctionItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-neutral-500">
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form
          action={createAuctionItemAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Item #</label>
            <input name="itemNumber" required className="w-20 rounded border border-neutral-300 px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Title</label>
            <input name="title" required className="rounded border border-neutral-300 px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Type</label>
            <select name="itemType" required className="rounded border border-neutral-300 px-2 py-1">
              <option value="SILENT">Silent</option>
              <option value="LIVE">Live</option>
              <option value="RAFFLE">Raffle</option>
              <option value="FIXED_PRICE">Fixed price</option>
              <option value="FUND_A_NEED">Fund a need</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">FMV $ (optional now)</label>
            <input name="fmvDollars" type="number" step="0.01" min={0} className="w-24 rounded border border-neutral-300 px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">FMV basis</label>
            <input name="fmvBasis" className="w-32 rounded border border-neutral-300 px-2 py-1" />
          </div>
          <button type="submit" className="rounded bg-brand-purple px-3 py-1.5 text-white">
            Add item
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          An item cannot open for bidding until its FMV is set — that gate is
          enforced server-side.
        </p>
      </section>

      {/* Item donors */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Item donors</h2>
          <a
            className="text-sm text-brand-purple underline"
            href={`/api/admin/item-donors?eventId=${eventId}&format=csv`}
          >
            Export CSV
          </a>
        </div>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-2 pr-4">Donor</th>
              <th className="py-2 pr-4">Claimed value</th>
              <th className="py-2 pr-4">8283 needed</th>
              <th className="py-2 pr-4">8283 received</th>
            </tr>
          </thead>
          <tbody>
            {itemDonors.map((donor) => (
              <tr key={donor.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4">{constituentName(donor.constituentId)}</td>
                <td className="py-2 pr-4">{formatCents(donor.claimedValueCents)}</td>
                <td className="py-2 pr-4">{donor.substantiationNeeded ? "Yes" : "No"}</td>
                <td className="py-2 pr-4">
                  {donor.form8283ReceivedAt
                    ? donor.form8283ReceivedAt.toISOString().slice(0, 10)
                    : "—"}
                </td>
              </tr>
            ))}
            {itemDonors.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-neutral-500">
                  No item donors recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form
          action={createItemDonorAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Donor</label>
            <select name="constituentId" required className="rounded border border-neutral-300 px-2 py-1">
              {constituents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isBusiness ? c.orgName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Claimed value $</label>
            <input
              name="claimedValueDollars"
              type="number"
              step="0.01"
              min={0}
              required
              className="w-28 rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Your name</label>
            <input name="actorId" required className="w-32 rounded border border-neutral-300 px-2 py-1" />
          </div>
          <button
            type="submit"
            disabled={constituents.length === 0}
            className="rounded bg-brand-purple px-3 py-1.5 text-white"
          >
            Add item donor
          </button>
        </form>
      </section>

      {/* Constituents */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Constituents</h2>
          <a
            className="text-sm text-brand-purple underline"
            href={`/api/admin/constituents?orgId=${event.orgId}&format=csv`}
          >
            Export CSV
          </a>
        </div>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Business</th>
            </tr>
          </thead>
          <tbody>
            {constituents.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4">
                  {c.isBusiness ? c.orgName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                </td>
                <td className="py-2 pr-4">{c.email ?? "—"}</td>
                <td className="py-2 pr-4">{c.isBusiness ? "Yes" : "No"}</td>
              </tr>
            ))}
            {constituents.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-neutral-500">
                  No constituents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form
          action={createConstituentAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4"
        >
          <input type="hidden" name="orgId" value={event.orgId} />
          <input type="hidden" name="eventId" value={eventId} />
          <label className="flex items-center gap-1 text-xs text-neutral-500">
            <input type="checkbox" name="isBusiness" /> Business donor
          </label>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">First name</label>
            <input name="firstName" className="rounded border border-neutral-300 px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Last name</label>
            <input name="lastName" className="rounded border border-neutral-300 px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Org name (business)</label>
            <input name="orgName" className="rounded border border-neutral-300 px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Email</label>
            <input name="email" type="email" className="rounded border border-neutral-300 px-2 py-1" />
          </div>
          <button type="submit" className="rounded bg-brand-purple px-3 py-1.5 text-white">
            Add constituent
          </button>
        </form>
      </section>
    </div>
  );
}
