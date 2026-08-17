import { listOrganizations } from "@/lib/admin/organizations";
import { listEvents } from "@/lib/admin/events";
import { getOrCreateDemoEvent } from "@/lib/demo/seed";
import { createEventAction, createOrganizationAction } from "./actions";
import { HubCard } from "./HubCard";
import { button, card, input, label as labelClass, table } from "./ui";
import {
  BookOpenIcon,
  CameraIcon,
  ClipboardListIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  FolderIcon,
  GavelIcon,
  MonitorIcon,
  PlayCircleIcon,
  SyncIcon,
  UploadIcon,
} from "./icons";

export default async function AdminHomePage() {
  const [organizations, events, demoEvent] = await Promise.all([
    listOrganizations(),
    listEvents(),
    getOrCreateDemoEvent(),
  ]);
  const eventsByOrg = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByOrg.get(event.orgId) ?? [];
    list.push(event);
    eventsByOrg.set(event.orgId, list);
  }

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-2xl font-semibold">Quick actions</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Everything below points at the live demo event — {demoEvent.name}.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            href="/story"
            icon={<PlayCircleIcon />}
            title="Story Mode"
            description="One link — auto-plays the whole night, doors open to donor CRM sync, on the real app"
          />
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
            href="/admin/sync-log"
            icon={<SyncIcon />}
            title="eTapestry Sync Log"
            description="Gift sync queue, idempotency, retries"
          />
          <HubCard
            href={`/admin/events/${demoEvent.id}/import`}
            icon={<UploadIcon />}
            title="Import Spreadsheet"
            description="Load historical gift data, get correct tax totals"
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
        <h2 className="text-xl font-semibold">Organizations</h2>
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

        <form
          action={createOrganizationAction}
          className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}
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
          <button type="submit" className={button.primary}>
            Add organization
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Events</h2>
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

        <form
          action={createEventAction}
          className={`mt-4 flex flex-wrap items-end gap-3 ${card}`}
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
          <button type="submit" className={button.primary} disabled={organizations.length === 0}>
            Add event
          </button>
        </form>
      </section>
    </div>
  );
}
