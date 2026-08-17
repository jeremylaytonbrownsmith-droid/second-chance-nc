import { listOrganizations } from "@/lib/admin/organizations";
import { listEvents } from "@/lib/admin/events";
import { getOrCreateDemoEvent } from "@/lib/demo/seed";
import { createEventAction, createOrganizationAction } from "./actions";
import { HubCard } from "./HubCard";
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">EIN</th>
                <th className="py-2 pr-4">Events</th>
                <th className="py-2 pr-4">Export</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">{org.name}</td>
                  <td className="py-2 pr-4">{org.ein ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {(eventsByOrg.get(org.id) ?? []).length}
                  </td>
                  <td className="py-2 pr-4">
                    <a
                      className="text-brand-purple underline"
                      href="/api/admin/organizations?format=csv"
                    >
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-neutral-500">
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          action={createOrganizationAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4"
        >
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Name</label>
            <input
              name="name"
              required
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">EIN</label>
            <input
              name="ein"
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">
              Fiscal year start (month)
            </label>
            <input
              name="fiscalYearStart"
              type="number"
              min={1}
              max={12}
              defaultValue={1}
              className="w-20 rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-brand-purple px-3 py-1.5 text-white transition-colors hover:bg-brand-purple-dark"
          >
            Add organization
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Events</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Tax year</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">{event.name}</td>
                  <td className="py-2 pr-4">
                    {event.eventDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-2 pr-4">{event.taxYear}</td>
                  <td className="py-2 pr-4">{event.status}</td>
                  <td className="py-2 pr-4">
                    <a
                      className="text-brand-purple underline"
                      href={`/admin/events/${event.id}`}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-neutral-500">
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          action={createEventAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4"
        >
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Organization</label>
            <select
              name="orgId"
              required
              className="rounded border border-neutral-300 px-2 py-1"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Event name</label>
            <input
              name="name"
              required
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Event date</label>
            <input
              name="eventDate"
              type="date"
              required
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Tax year</label>
            <input
              name="taxYear"
              type="number"
              required
              defaultValue={new Date().getUTCFullYear()}
              className="w-24 rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-brand-purple px-3 py-1.5 text-white transition-colors hover:bg-brand-purple-dark"
            disabled={organizations.length === 0}
          >
            Add event
          </button>
        </form>
      </section>
    </div>
  );
}
