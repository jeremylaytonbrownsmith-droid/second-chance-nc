import { listOrganizations } from "@/lib/admin/organizations";
import { listEvents } from "@/lib/admin/events";
import { createEventAction, createOrganizationAction } from "./actions";

export default async function AdminHomePage() {
  const organizations = await listOrganizations();
  const events = await listEvents();
  const eventsByOrg = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByOrg.get(event.orgId) ?? [];
    list.push(event);
    eventsByOrg.set(event.orgId, list);
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <table className="mt-4 w-full border-collapse text-sm">
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
            className="rounded bg-brand-purple px-3 py-1.5 text-white"
          >
            Add organization
          </button>
        </form>
      </section>

      <section>
        <h1 className="text-2xl font-semibold">Events</h1>
        <table className="mt-4 w-full border-collapse text-sm">
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
            className="rounded bg-brand-purple px-3 py-1.5 text-white"
            disabled={organizations.length === 0}
          >
            Add event
          </button>
        </form>
      </section>
    </div>
  );
}
