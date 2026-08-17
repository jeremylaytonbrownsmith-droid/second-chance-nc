import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listSolicitationCategories, listSolicitations } from "@/lib/admin/solicitations";
import { createSolicitationAction, setSolicitationStatusAction } from "../../../actions";
import { SolicitationImportUploader } from "./SolicitationImportUploader";
import { button, card, input, label as labelClass, table } from "../../../ui";

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  CONTACTED: "Contacted",
  COMMITTED: "Committed",
  DECLINED: "Declined",
  DONATED: "Donated",
  DO_NOT_CONTACT: "Do not contact",
};

const STATUS_STYLES: Record<string, string> = {
  PROSPECT: "bg-neutral-100 text-neutral-700",
  CONTACTED: "bg-blue-100 text-blue-800",
  COMMITTED: "bg-amber-100 text-amber-800",
  DECLINED: "bg-red-100 text-red-800",
  DONATED: "bg-green-100 text-green-800",
  DO_NOT_CONTACT: "bg-neutral-800 text-white",
};

const DELIVERY_LABELS: Record<string, string> = {
  MAIL: "Mail",
  PICKUP: "Pickup",
  DROPOFF: "Drop-off",
  DIGITAL: "Digital",
};

export default async function SolicitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string; category?: string; q?: string; page?: string }>;
}) {
  const { eventId } = await params;
  const { status, category, q, page: pageParam } = await searchParams;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const page = Math.max(1, Number(pageParam) || 1);

  const [{ solicitations, total, pageCount }, categories] = await Promise.all([
    listSolicitations(eventId, { status: status as never, category, search: q }, page),
    listSolicitationCategories(eventId),
  ]);

  const filterBase = `/admin/events/${eventId}/solicitations`;
  const queryString = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, category, q, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Solicitations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Who you&rsquo;ve asked for a donation, what category, and whether it&rsquo;s come
          in yet — the list that exists before an item ever hits the catalog.{" "}
          {total.toLocaleString()} total.
        </p>
        <div className="mt-3 flex flex-wrap gap-1 text-sm">
          <a href={`/admin/events/${eventId}`} className={button.ghost}>
            Item catalog
          </a>
          <a href={`/admin/events/${eventId}/donations/new`} className={button.ghost}>
            Log a donation
          </a>
          <a className={button.ghost} href={`/api/admin/solicitations?eventId=${eventId}&format=csv`}>
            Export CSV
          </a>
        </div>
        <div className="mt-3">
          <SolicitationImportUploader eventId={eventId} />
        </div>
      </div>

      <form className={`flex flex-wrap items-end gap-3 text-sm ${card}`}>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Search</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email, notes, solicitor"
            className={`w-56 ${input}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Category</label>
          <select name="category" defaultValue={category ?? ""} className={input}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Status</label>
          <select name="status" defaultValue={status ?? ""} className={input}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={button.secondary}>
          Filter
        </button>
        {(status || category || q) && (
          <a href={filterBase} className={button.ghost}>
            Clear
          </a>
        )}
      </form>

      <div className={table.wrapper}>
        <table className={`min-w-[720px] ${table.table}`}>
          <thead>
            <tr className={table.headRow}>
              <th className={table.th}>Contact</th>
              <th className={table.th}>Category</th>
              <th className={table.th}>Assigned to</th>
              <th className={table.th}>Est. value</th>
              <th className={table.th}>Status</th>
              <th className={table.th}></th>
            </tr>
          </thead>
          <tbody>
            {solicitations.map((s) => (
              <tr key={s.id} className={table.row}>
                <td className={table.td}>
                  <div className="font-medium">
                    {s.contactName}
                    {s.priorYearDonor && (
                      <span
                        title="Gave in a recent prior year"
                        className="ml-1.5 rounded-full bg-brand-lavender-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand-purple-dark"
                      >
                        Repeat
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {[s.contactEmail, s.contactPhone].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {s.deliveryMethod && (
                    <div className="text-xs text-neutral-500">
                      {DELIVERY_LABELS[s.deliveryMethod]}
                    </div>
                  )}
                  {s.notes && <div className="mt-1 max-w-xs text-xs text-neutral-500">{s.notes}</div>}
                </td>
                <td className={table.td}>{s.category ?? "—"}</td>
                <td className={table.td}>{s.assignedTo ?? "—"}</td>
                <td className={table.td}>{formatCents(s.estimatedValueCents)}</td>
                <td className={table.td}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}
                  >
                    {STATUS_LABELS[s.status]}
                  </span>
                </td>
                <td className={table.td}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {s.status !== "DONATED" && s.status !== "DO_NOT_CONTACT" && (
                      <a
                        href={`/admin/events/${eventId}/donations/new?solicitationId=${s.id}&contactName=${encodeURIComponent(s.contactName)}&contactEmail=${encodeURIComponent(s.contactEmail ?? "")}&contactPhone=${encodeURIComponent(s.contactPhone ?? "")}&category=${encodeURIComponent(s.category ?? "")}`}
                        className={button.tableAction}
                      >
                        Log donation
                      </a>
                    )}
                    {s.status === "PROSPECT" && (
                      <StatusForm eventId={eventId} solicitationId={s.id} status="CONTACTED" label="Mark contacted" />
                    )}
                    {(s.status === "CONTACTED" || s.status === "PROSPECT") && (
                      <StatusForm eventId={eventId} solicitationId={s.id} status="COMMITTED" label="Mark committed" />
                    )}
                    {s.status !== "DECLINED" && s.status !== "DONATED" && s.status !== "DO_NOT_CONTACT" && (
                      <StatusForm eventId={eventId} solicitationId={s.id} status="DECLINED" label="Mark declined" />
                    )}
                    {s.status !== "DONATED" && s.status !== "DO_NOT_CONTACT" && (
                      <StatusForm
                        eventId={eventId}
                        solicitationId={s.id}
                        status="DO_NOT_CONTACT"
                        label="Do not contact"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {solicitations.length === 0 && (
              <tr>
                <td colSpan={6} className={table.empty}>
                  No solicitations match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            Page {page} of {pageCount} — {total.toLocaleString()} solicitations
          </span>
          <div className="flex gap-1">
            {page > 1 && (
              <a className={button.ghost} href={`${filterBase}?${queryString({ page: String(page - 1) })}`}>
                ← Previous
              </a>
            )}
            {page < pageCount && (
              <a className={button.ghost} href={`${filterBase}?${queryString({ page: String(page + 1) })}`}>
                Next →
              </a>
            )}
          </div>
        </div>
      )}

      <form action={createSolicitationAction} className={`flex flex-wrap items-end gap-3 text-sm ${card}`}>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Contact / business name</label>
          <input name="contactName" required className={`w-44 ${input}`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Email</label>
          <input name="contactEmail" type="email" className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Phone</label>
          <input name="contactPhone" className={`w-32 ${input}`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Category</label>
          <input name="category" list="category-suggestions" placeholder="e.g. Restaurant" className={`w-36 ${input}`} />
          <datalist id="category-suggestions">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Assigned to</label>
          <input name="assignedTo" placeholder="Solicitor" className={`w-32 ${input}`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Est. value $</label>
          <input name="estimatedValueDollars" type="number" step="0.01" min={0} className={`w-24 ${input}`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Status</label>
          <select name="status" defaultValue="CONTACTED" className={input}>
            <option value="PROSPECT">Prospect (not asked yet)</option>
            <option value="CONTACTED">Contacted</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Notes</label>
          <input name="notes" className={`w-40 ${input}`} />
        </div>
        <button type="submit" className={button.primary}>
          Add solicitation
        </button>
      </form>
    </div>
  );
}

function StatusForm({
  eventId,
  solicitationId,
  status,
  label,
}: {
  eventId: string;
  solicitationId: string;
  status: string;
  label: string;
}) {
  return (
    <form action={setSolicitationStatusAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="solicitationId" value={solicitationId} />
      <input type="hidden" name="status" value={status} />
      <button className={button.tableAction}>{label}</button>
    </form>
  );
}
