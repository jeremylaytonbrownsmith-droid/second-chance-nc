import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listConstituents } from "@/lib/admin/constituents";
import { listItemDonors } from "@/lib/admin/item-donors";
import { listAuctionItemCategories, listAuctionItems } from "@/lib/admin/auction-items";
import { listAuditLogsForEvent } from "@/lib/admin/audit-log";
import {
  closeAuctionItemAction,
  createAuctionItemAction,
  createConstituentAction,
  createItemDonorAction,
  openAuctionItemAction,
  setAuctionItemFmvAction,
} from "../../actions";
import { button, card, input, label as labelClass, table } from "../../ui";
import { getStaffRole } from "@/lib/admin/session";
import { AdminForm } from "../../AdminForm";
import { SubmitButton } from "../../SubmitButton";

export const dynamic = "force-dynamic";

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
  const isAdmin = (await getStaffRole()) === "admin";
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [constituents, itemDonors, auctionItems, itemCategories, auditLogs] = await Promise.all([
    listConstituents(event.orgId),
    listItemDonors(eventId),
    listAuctionItems(eventId, { category, search: q }),
    listAuctionItemCategories(eventId),
    isAdmin ? listAuditLogsForEvent(eventId) : Promise.resolve([]),
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
          <Link href="/bid" className={button.ghost}>
            Bidder view
          </Link>
          {isAdmin && (
            <>
              <a href={`/admin/events/${eventId}/checkout`} className={button.ghost}>
                Checkout
              </a>
              <a href={`/admin/events/${eventId}/import`} className={button.ghost}>
                Import spreadsheet
              </a>
              <a href={`/admin/events/${eventId}/solicitations`} className={button.ghost}>
                Solicitations
              </a>
              <a href={`/admin/events/${eventId}/donations/new`} className={button.ghost}>
                Log a donation
              </a>
            </>
          )}
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
                    {isAdmin ? (
                      <div className="flex flex-col gap-2">
                        {item.fmvCents === null && (
                          <AdminForm
                            action={setAuctionItemFmvAction}
                            successMessage="FMV set."
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
                              className={`w-20 ${input}`}
                            />
                            <input name="fmvBasis" placeholder="basis" required className={`w-28 ${input}`} />
                            <SubmitButton pendingLabel="Setting…" className={button.primary}>
                              Set FMV
                            </SubmitButton>
                          </AdminForm>
                        )}
                        {item.fmvCents !== null && item.status === "DRAFT" && (
                          <AdminForm
                            action={openAuctionItemAction}
                            successMessage="Item opened for bidding."
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="eventId" value={eventId} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <SubmitButton pendingLabel="Opening…" className={button.primary}>
                              Open
                            </SubmitButton>
                          </AdminForm>
                        )}
                        {item.status === "OPEN" && (
                          <AdminForm
                            action={closeAuctionItemAction}
                            successMessage="Item closed."
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="eventId" value={eventId} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <SubmitButton
                              pendingLabel="Closing…"
                              className={button.primary}
                              confirmMessage={`Close bidding on ${item.itemNumber} — ${item.title}? This can't be undone from here.`}
                            >
                              Close
                            </SubmitButton>
                          </AdminForm>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">Admins only</span>
                    )}
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

        {isAdmin && (
          <>
            <AdminForm
              action={createAuctionItemAction}
              successMessage="Item added."
              className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}
            >
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
              <SubmitButton pendingLabel="Adding…" className={button.primary}>
                Add item
              </SubmitButton>
            </AdminForm>
            <p className="mt-2 text-xs text-neutral-500">
              An item cannot open for bidding until its FMV is set — that gate is
              enforced server-side.
            </p>
          </>
        )}
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

        {isAdmin && (
          <AdminForm
            action={createItemDonorAction}
            successMessage="Item donor added."
            className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}
          >
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
            <SubmitButton pendingLabel="Adding…" disabled={constituents.length === 0} className={button.primary}>
              Add item donor
            </SubmitButton>
          </AdminForm>
        )}
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

        {isAdmin && (
          <AdminForm
            action={createConstituentAction}
            successMessage="Constituent added."
            className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}
          >
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
            <SubmitButton pendingLabel="Adding…" className={button.primary}>
              Add constituent
            </SubmitButton>
          </AdminForm>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2 className="text-xl font-semibold">Activity log</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Every change to this event&apos;s items, donors, transactions, and awards — who, what,
            and when. Most recent first.
          </p>
          <div className={`mt-4 ${table.wrapper}`}>
            <table className={`min-w-[720px] ${table.table}`}>
              <thead>
                <tr className={table.headRow}>
                  <th className={table.th}>When</th>
                  <th className={table.th}>Actor</th>
                  <th className={table.th}>Action</th>
                  <th className={table.th}>Entity</th>
                  <th className={table.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className={table.row}>
                    <td className={`${table.td} whitespace-nowrap`}>{log.createdAt.toISOString()}</td>
                    <td className={`${table.td} capitalize`}>{log.actorId}</td>
                    <td className={table.td}>{log.action}</td>
                    <td className={`${table.td} font-mono text-xs`}>
                      {log.entityType} {log.entityId.slice(0, 10)}…
                    </td>
                    <td className={table.td}>
                      {(log.beforeJson !== null || log.afterJson !== null) && (
                        <details>
                          <summary className="cursor-pointer text-xs text-brand-purple">View</summary>
                          <pre className="mt-1 max-w-sm overflow-x-auto rounded bg-neutral-50 p-2 text-[11px]">
                            {JSON.stringify({ before: log.beforeJson, after: log.afterJson }, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className={table.empty}>
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
