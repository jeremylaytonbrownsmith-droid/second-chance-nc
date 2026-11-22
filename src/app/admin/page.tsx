import { listOrganizations } from "@/lib/admin/organizations";
import { listEvents } from "@/lib/admin/events";
import { getOrCreateDemoEvent } from "@/lib/demo/seed";
import { getStaffRole } from "@/lib/admin/session";
import { getTotalRaisedCents } from "@/lib/checkout/checkout";
import { prisma } from "@/lib/prisma";
import { createEventAction, createOrganizationAction } from "./actions";
import { AdminForm } from "./AdminForm";
import { SubmitButton } from "./SubmitButton";
import { HubCard } from "./HubCard";
import { Modal } from "./Modal";
import { button, card, input, label as labelClass, table } from "./ui";
import {
  BookOpenIcon,
  CameraIcon,
  CheckInDoorIcon,
  ClipboardListIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  DocumentIcon,
  FolderIcon,
  GavelIcon,
  GiftIcon,
  MonitorIcon,
  PackageIcon,
  PlayCircleIcon,
  PulseIcon,
  SyncIcon,
  UploadIcon,
  UsersIcon,
} from "./icons";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function AdminHomePage() {
  const [organizations, events, demoEvent, isAdmin] = await Promise.all([
    listOrganizations(),
    listEvents(),
    getOrCreateDemoEvent(),
    getStaffRole().then((role) => role === "admin"),
  ]);
  const eventsByOrg = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByOrg.get(event.orgId) ?? [];
    list.push(event);
    eventsByOrg.set(event.orgId, list);
  }

  const [raisedCents, itemCount, checkedInCount, unclaimedAwardCount] = await Promise.all([
    getTotalRaisedCents(demoEvent.id),
    prisma.auctionItem.count({ where: { eventId: demoEvent.id, voidedAt: null } }),
    prisma.registration.count({ where: { eventId: demoEvent.id, status: "CHECKED_IN" } }),
    prisma.award.count({ where: { item: { eventId: demoEvent.id }, voidedAt: null, pickedUpAt: null } }),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-purple">Second Chance</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-purple-dark">
          {demoEvent.name}
        </h1>
        <div className={`mt-4 ${card} flex flex-wrap items-center gap-6 sm:gap-10`}>
          <div>
            <p className="text-xs font-medium text-neutral-500">Status</p>
            <p className="mt-0.5 text-lg font-semibold text-neutral-900">{demoEvent.status}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Raised so far</p>
            <p className="mt-0.5 text-lg font-semibold text-brand-purple-dark">{money(raisedCents)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Items</p>
            <p className="mt-0.5 text-lg font-semibold text-neutral-900">{itemCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Checked in</p>
            <p className="mt-0.5 text-lg font-semibold text-neutral-900">{checkedInCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Unclaimed items</p>
            <p className="mt-0.5 text-lg font-semibold text-neutral-900">{unclaimedAwardCount}</p>
          </div>
          <a href={`/admin/events/${demoEvent.id}`} className={`ml-auto ${button.primary}`}>
            Open event →
          </a>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-purple-dark">Before the event</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            href={`/admin/events/${demoEvent.id}`}
            icon={<FolderIcon />}
            title="Item Catalog"
            description="Auction items, FMV entry, item donors, 8283 flags — searchable by category"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/solicitations`}
            icon={<ClipboardListIcon />}
            title="Solicitations"
            description="Who you've asked for a donation, by category and status"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/donations/new`}
            icon={<CameraIcon />}
            title="Log a Donation"
            description="Snap a photo, describe it, set a value — creates the catalog item"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/import`}
            icon={<UploadIcon />}
            title="Import Spreadsheet"
            description="Load historical gift data, get correct tax totals"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-purple-dark">During the event</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            href={`/admin/events/${demoEvent.id}/checkin`}
            icon={<CheckInDoorIcon />}
            title="Check In"
            description="Search or walk-in, assigns a paddle number and QR code"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/live`}
            icon={<MonitorIcon />}
            title="Live Auction Board"
            description="Every item's price live on one screen — click bids from multiple simulated bidders and watch it react"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/clerk`}
            icon={<GavelIcon />}
            title="Live Auction Clerk"
            description="Item #, paddle #, hammer price — one screen"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/fund-a-need`}
            icon={<GiftIcon />}
            title="Fund a Need"
            description="Pick a giving level, tap every paddle that went up, submit as one batch"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/checkout`}
            icon={<CreditCardIcon />}
            title="Checkout"
            description="Consolidated checkout with live deductible math"
          />
          <HubCard
            href="/bid"
            icon={<DeviceMobileIcon />}
            title="Bidder View"
            description="Mobile browse + live bidding, updates in real time"
          />
          <HubCard
            href="/live"
            icon={<PulseIcon />}
            title="Live Event Board"
            description="The screen for the room — every price live, no bidder login needed to watch"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-purple-dark">After the event</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            href={`/admin/events/${demoEvent.id}/pickup`}
            icon={<PackageIcon />}
            title="Pickup"
            description="Mark won items picked up, see what's still unclaimed"
          />
          <HubCard
            href="/admin/sync-log"
            icon={<SyncIcon />}
            title="eTapestry Sync Log"
            description="Gift sync queue, idempotency, retries"
          />
          <HubCard
            href="/admin/statements"
            icon={<DocumentIcon />}
            title="Year-End Statements"
            description="Per-donor giving summary for tax season — PDF and CSV"
          />
          <HubCard
            href="/admin/duplicates"
            icon={<UsersIcon />}
            title="Duplicate Donors"
            description="Likely duplicate constituent records, with a merge screen"
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-purple-dark">Reference</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            href="/story"
            icon={<PlayCircleIcon />}
            title="Story Mode"
            description="One link — auto-plays the whole night, doors open to donor CRM sync, on the real app"
          />
          <HubCard
            href="/admin/help"
            icon={<BookOpenIcon />}
            title="Help & Guide"
            description="How every screen works, written for staff, not developers"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-purple-dark">Organizations</h2>
          {isAdmin && (
            <Modal triggerLabel="+ Add organization" triggerClassName={button.secondary} title="Add organization">
              <AdminForm
                action={createOrganizationAction}
                successMessage="Organization added."
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Name</label>
                  <input name="name" required className={input} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>EIN</label>
                  <input name="ein" className={input} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Fiscal year start (month)</label>
                  <input
                    name="fiscalYearStart"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={1}
                    className={`w-20 ${input}`}
                  />
                </div>
                <SubmitButton pendingLabel="Adding…" className={button.primary}>
                  Add organization
                </SubmitButton>
              </AdminForm>
            </Modal>
          )}
        </div>
        <div className={`mt-4 ${table.wrapper}`}>
          <table className={`min-w-[480px] ${table.table}`}>
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}>Name</th>
                <th className={table.th}>EIN</th>
                <th className={table.th}>Events</th>
                <th className={table.th}>Export</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id} className={table.row}>
                  <td className={table.td}>{org.name}</td>
                  <td className={table.td}>{org.ein ?? "—"}</td>
                  <td className={table.td}>
                    {(eventsByOrg.get(org.id) ?? []).length}
                  </td>
                  <td className={table.td}>
                    <a className={button.ghost} href="/api/admin/organizations?format=csv">
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={4} className={table.empty}>
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-purple-dark">Events</h2>
          {isAdmin && (
            <Modal triggerLabel="+ Add event" triggerClassName={button.secondary} title="Add event">
              <AdminForm
                action={createEventAction}
                successMessage="Event added."
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Organization</label>
                  <select name="orgId" required className={input}>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Event name</label>
                  <input name="name" required className={input} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Event date</label>
                  <input name="eventDate" type="date" required className={input} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Tax year</label>
                  <input
                    name="taxYear"
                    type="number"
                    required
                    defaultValue={new Date().getUTCFullYear()}
                    className={`w-24 ${input}`}
                  />
                </div>
                <SubmitButton
                  pendingLabel="Adding…"
                  className={button.primary}
                  disabled={organizations.length === 0}
                >
                  Add event
                </SubmitButton>
              </AdminForm>
            </Modal>
          )}
        </div>
        <div className={`mt-4 ${table.wrapper}`}>
          <table className={`min-w-[560px] ${table.table}`}>
            <thead>
              <tr className={table.headRow}>
                <th className={table.th}>Name</th>
                <th className={table.th}>Date</th>
                <th className={table.th}>Tax year</th>
                <th className={table.th}>Status</th>
                <th className={table.th}></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className={table.row}>
                  <td className={table.td}>{event.name}</td>
                  <td className={table.td}>
                    {event.eventDate.toISOString().slice(0, 10)}
                  </td>
                  <td className={table.td}>{event.taxYear}</td>
                  <td className={table.td}>{event.status}</td>
                  <td className={table.td}>
                    <a className={button.ghost} href={`/admin/events/${event.id}`}>
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className={table.empty}>
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
