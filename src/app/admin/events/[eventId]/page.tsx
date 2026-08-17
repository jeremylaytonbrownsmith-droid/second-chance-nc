import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listConstituents } from "@/lib/admin/constituents";
import { listItemDonors } from "@/lib/admin/item-donors";
import { listAuctionItemCategories, listAuctionItems } from "@/lib/admin/auction-items";
import {
  closeAuctionItemAction,
  createAuctionItemAction,
  createConstituentAction,
  createItemDonorAction,
  openAuctionItemAction,
  setAuctionItemFmvAction,
} from "../../actions";
import { button, card, input, label as labelClass, table } from "../../ui";

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { eventId } = await params;
  const { category, q } = await searchParams;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [constituents, itemDonors, auctionItems, itemCategories] = await Promise.all([
    listConstituents(event.orgId),
    listItemDonors(eventId),
    listAuctionItems(eventId, { category, search: q }),
    listAuctionItemCategories(eventId),
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
        <div className="mt-3 flex flex-wrap gap-1 text-sm">
          <a href={`/admin/events/${eventId}/live`} className={button.ghost}>
            Live auction board
          </a>
          <a href={`/admin/events/${eventId}/clerk`} className={button.ghost}>
            Live auction clerk
          </a>
          <a href={`/admin/events/${eventId}/checkout`} className={button.ghost}>
            Checkout
          </a>
          <Link href="/bid" className={button.ghost}>
            Bidder view
          </Link>
          <a href={`/admin/events/${eventId}/import`} className={button.ghost}>
            Import spreadsheet
          </a>
          <a href={`/admin/events/${eventId}/solicitations`} className={button.ghost}>
            Solicitations
          </a>
          <a href={`/admin/events/${eventId}/donations/new`} className={button.ghost}>
            Log a donation
          </a>
        </div>
      </div>

      {/* Auction items */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Item catalog</h2>
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <a className={button.ghost} href={`/api/admin/events/${eventId}/givesmart-export`}>
              Export for GiveSmart
            </a>
            <a className={button.ghost} href={`/api/admin/auction-items?eventId=${eventId}&format=csv`}>
              Export CSV
            </a>
          </div>
        </div>
        <form className="mt-3 flex flex-wrap items-end gap-3 text-sm" action={`/admin/events/${eventId}`}>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Search</label>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Title, description, item #"
              className={`w-56 ${input}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Category</label>
            <select name="category" defaultValue={category ?? ""} className={input}>
              <option value="">All categories</option>
              {itemCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={button.secondary}>
            Filter
          </button>
          {(category || q) && (
            <a href={`/admin/events/${eventId}`} className={button.ghost}>
              Clear
            </a>
          )}
        </form>
        <div className={`mt-4 ${table.wrapper}`}>
          <table className={table.table}>
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}></th>
                <th className={table.th}>#</th>
                <th className={table.th}>Title</th>
                <th className={table.th}>Category</th>
                <th className={table.th}>Type</th>
                <th className={table.th}>FMV</th>
                <th className={table.th}>Status</th>
                <th className={table.th}></th>
              </tr>
            </thead>
            <tbody>
              {auctionItems.map((item) => (
                <tr key={item.id} className={table.row}>
                  <td className={table.td}>
                    {item.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.images[0]}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-neutral-100" />
                    )}
                  </td>
                  <td className={table.td}>{item.itemNumber}</td>
                  <td className={table.td}>{item.title}</td>
                  <td className={table.td}>{item.category ?? "—"}</td>
                  <td className={table.td}>{item.itemType}</td>
                  <td className={table.td}>{formatCents(item.fmvCents)}</td>
                  <td className={table.td}>{item.status}</td>
                  <td className={table.td}>
                    <div className="flex flex-col gap-2">
                      {item.fmvCents === null && (
                        <form action={setAuctionItemFmvAction} className="flex items-center gap-1">
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input
                            name="fmvDollars"
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="FMV $"
                            required
                            className={`w-20 ${input}`}
                          />
                          <input name="fmvBasis" placeholder="basis" required className={`w-28 ${input}`} />
                          <input name="actorId" placeholder="your name" required className={`w-24 ${input}`} />
                          <button className={button.primary}>Set FMV</button>
                        </form>
                      )}
                      {item.fmvCents !== null && item.status === "DRAFT" && (
                        <form action={openAuctionItemAction} className="flex items-center gap-1">
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input name="actorId" placeholder="your name" required className={`w-24 ${input}`} />
                          <button className={button.primary}>Open</button>
                        </form>
                      )}
                      {item.status === "OPEN" && (
                        <form action={closeAuctionItemAction} className="flex items-center gap-1">
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input name="actorId" placeholder="your name" required className={`w-24 ${input}`} />
                          <button className={button.primary}>Close</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {auctionItems.length === 0 && (
                <tr>
                  <td colSpan={8} className={table.empty}>
                    No items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={createAuctionItemAction} className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}>
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Item #</label>
            <input name="itemNumber" required className={`w-20 ${input}`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Title</label>
            <input name="title" required className={input} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Type</label>
            <select name="itemType" required className={input}>
              <option value="SILENT">Silent</option>
              <option value="LIVE">Live</option>
              <option value="RAFFLE">Raffle</option>
              <option value="FIXED_PRICE">Fixed price</option>
              <option value="FUND_A_NEED">Fund a need</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>FMV $ (optional now)</label>
            <input name="fmvDollars" type="number" step="0.01" min={0} className={`w-24 ${input}`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>FMV basis</label>
            <input name="fmvBasis" className={`w-32 ${input}`} />
          </div>
          <button type="submit" className={button.primary}>
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
          <a className={button.ghost} href={`/api/admin/item-donors?eventId=${eventId}&format=csv`}>
            Export CSV
          </a>
        </div>
        <div className={`mt-4 ${table.wrapper}`}>
          <table className={table.table}>
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}>Donor</th>
                <th className={table.th}>Claimed value</th>
                <th className={table.th}>8283 needed</th>
                <th className={table.th}>8283 received</th>
              </tr>
            </thead>
            <tbody>
              {itemDonors.map((donor) => (
                <tr key={donor.id} className={table.row}>
                  <td className={table.td}>{constituentName(donor.constituentId)}</td>
                  <td className={table.td}>{formatCents(donor.claimedValueCents)}</td>
                  <td className={table.td}>{donor.substantiationNeeded ? "Yes" : "No"}</td>
                  <td className={table.td}>
                    {donor.form8283ReceivedAt
                      ? donor.form8283ReceivedAt.toISOString().slice(0, 10)
                      : "—"}
                  </td>
                </tr>
              ))}
              {itemDonors.length === 0 && (
                <tr>
                  <td colSpan={4} className={table.empty}>
                    No item donors recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={createItemDonorAction} className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}>
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Donor</label>
            <select name="constituentId" required className={input}>
              {constituents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isBusiness ? c.orgName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Claimed value $</label>
            <input
              name="claimedValueDollars"
              type="number"
              step="0.01"
              min={0}
              required
              className={`w-28 ${input}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Your name</label>
            <input name="actorId" required className={`w-32 ${input}`} />
          </div>
          <button type="submit" disabled={constituents.length === 0} className={button.primary}>
            Add item donor
          </button>
        </form>
      </section>

      {/* Constituents */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Constituents</h2>
          <a className={button.ghost} href={`/api/admin/constituents?orgId=${event.orgId}&format=csv`}>
            Export CSV
          </a>
        </div>
        <div className={`mt-4 ${table.wrapper}`}>
          <table className={table.table}>
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}>Name</th>
                <th className={table.th}>Email</th>
                <th className={table.th}>Business</th>
              </tr>
            </thead>
            <tbody>
              {constituents.map((c) => (
                <tr key={c.id} className={table.row}>
                  <td className={table.td}>
                    {c.isBusiness ? c.orgName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                  </td>
                  <td className={table.td}>{c.email ?? "—"}</td>
                  <td className={table.td}>{c.isBusiness ? "Yes" : "No"}</td>
                </tr>
              ))}
              {constituents.length === 0 && (
                <tr>
                  <td colSpan={3} className={table.empty}>
                    No constituents yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={createConstituentAction} className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}>
          <input type="hidden" name="orgId" value={event.orgId} />
          <input type="hidden" name="eventId" value={eventId} />
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            <input type="checkbox" name="isBusiness" /> Business donor
          </label>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>First name</label>
            <input name="firstName" className={input} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Last name</label>
            <input name="lastName" className={input} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Org name (business)</label>
            <input name="orgName" className={input} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Email</label>
            <input name="email" type="email" className={input} />
          </div>
          <button type="submit" className={button.primary}>
            Add constituent
          </button>
        </form>
      </section>
    </div>
  );
}
