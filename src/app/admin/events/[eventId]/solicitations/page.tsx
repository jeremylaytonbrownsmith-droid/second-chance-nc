import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listSolicitationCategories, listSolicitations } from "@/lib/admin/solicitations";
import { createSolicitationAction, setSolicitationStatusAction } from "../../../actions";

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  ASKED: "Asked",
  DECLINED: "Declined",
  DONATED: "Donated",
};

const STATUS_STYLES: Record<string, string> = {
  PROSPECT: "bg-neutral-100 text-neutral-700",
  ASKED: "bg-blue-100 text-blue-800",
  DECLINED: "bg-red-100 text-red-800",
  DONATED: "bg-green-100 text-green-800",
};

export default async function SolicitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const { eventId } = await params;
  const { status, category, q } = await searchParams;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [solicitations, categories] = await Promise.all([
    listSolicitations(eventId, {
      status: status as never,
      category,
      search: q,
    }),
    listSolicitationCategories(eventId),
  ]);

  const filterBase = `/admin/events/${eventId}/solicitations`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Solicitations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Who you&rsquo;ve asked for a donation, what category, and whether it&rsquo;s come
          in yet — the list that exists before an item ever hits the catalog.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <a href={`/admin/events/${eventId}`} className="text-brand-purple underline">
            Item catalog
          </a>
          <a href={`/admin/events/${eventId}/donations/new`} className="text-brand-purple underline">
            Log a donation
          </a>
          <a
            className="text-brand-purple underline"
            href={`/api/admin/solicitations?eventId=${eventId}&format=csv`}
          >
            Export CSV
          </a>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4 text-sm">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Search</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email, notes"
            className="w-56 rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Category</label>
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded border border-brand-purple px-3 py-1.5 text-brand-purple transition-colors hover:bg-brand-lavender-tint"
        >
          Filter
        </button>
        {(status || category || q) && (
          <a href={filterBase} className="text-neutral-500 underline">
            Clear
          </a>
        )}
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">Est. value</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {solicitations.map((s) => (
            <tr key={s.id} className="border-b border-neutral-100 align-top">
              <td className="py-2 pr-4">
                <div className="font-medium">{s.contactName}</div>
                <div className="text-xs text-neutral-500">
                  {[s.contactEmail, s.contactPhone].filter(Boolean).join(" · ") || "—"}
                </div>
                {s.notes && <div className="mt-1 text-xs text-neutral-500">{s.notes}</div>}
              </td>
              <td className="py-2 pr-4">{s.category ?? "—"}</td>
              <td className="py-2 pr-4">{formatCents(s.estimatedValueCents)}</td>
              <td className="py-2 pr-4">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}
                >
                  {STATUS_LABELS[s.status]}
                </span>
              </td>
              <td className="py-2 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  {s.status !== "DONATED" && (
                    <a
                      href={`/admin/events/${eventId}/donations/new?solicitationId=${s.id}&contactName=${encodeURIComponent(s.contactName)}&contactEmail=${encodeURIComponent(s.contactEmail ?? "")}&contactPhone=${encodeURIComponent(s.contactPhone ?? "")}&category=${encodeURIComponent(s.category ?? "")}`}
                      className="text-brand-purple underline"
                    >
                      Log donation
                    </a>
                  )}
                  {s.status === "PROSPECT" && (
                    <form action={setSolicitationStatusAction}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="solicitationId" value={s.id} />
                      <input type="hidden" name="status" value="ASKED" />
                      <button className="text-neutral-600 underline">Mark asked</button>
                    </form>
                  )}
                  {(s.status === "PROSPECT" || s.status === "ASKED") && (
                    <form action={setSolicitationStatusAction}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="solicitationId" value={s.id} />
                      <input type="hidden" name="status" value="DECLINED" />
                      <button className="text-neutral-600 underline">Mark declined</button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {solicitations.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-neutral-500">
                No solicitations match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form
        action={createSolicitationAction}
        className="flex flex-wrap items-end gap-3 rounded border border-brand-lavender bg-white p-4 text-sm"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Contact / business name</label>
          <input
            name="contactName"
            required
            className="w-44 rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Email</label>
          <input name="contactEmail" type="email" className="rounded border border-neutral-300 px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Phone</label>
          <input name="contactPhone" className="w-32 rounded border border-neutral-300 px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Category</label>
          <input
            name="category"
            list="category-suggestions"
            placeholder="e.g. Restaurants"
            className="w-36 rounded border border-neutral-300 px-2 py-1"
          />
          <datalist id="category-suggestions">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Est. value $</label>
          <input
            name="estimatedValueDollars"
            type="number"
            step="0.01"
            min={0}
            className="w-24 rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Status</label>
          <select name="status" defaultValue="ASKED" className="rounded border border-neutral-300 px-2 py-1">
            <option value="PROSPECT">Prospect (not asked yet)</option>
            <option value="ASKED">Asked</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Notes</label>
          <input name="notes" className="w-40 rounded border border-neutral-300 px-2 py-1" />
        </div>
        <button
          type="submit"
          className="rounded bg-brand-purple px-3 py-1.5 text-white transition-colors hover:bg-brand-purple-dark"
        >
          Add solicitation
        </button>
      </form>
    </div>
  );
}
