import { listOrganizations } from "@/lib/admin/organizations";
import { findDuplicateConstituentGroups } from "@/lib/admin/duplicate-detection";
import { mergeConstituentsAction } from "../actions";
import { getStaffRole } from "@/lib/admin/session";
import { AdminOnlyNotice } from "../AdminOnlyNotice";
import { AdminForm } from "../AdminForm";
import { SubmitButton } from "../SubmitButton";
import { button, card, input, label as labelClass } from "../ui";

export const dynamic = "force-dynamic";

const REASON_LABELS = {
  email: "Same email address",
  name_and_phone: "Similar name + same phone number",
};

export default async function DuplicateConstituentsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  if ((await getStaffRole()) !== "admin") return <AdminOnlyNotice />;

  const organizations = await listOrganizations();
  const { orgId: orgIdParam } = await searchParams;
  const orgId = orgIdParam ?? organizations[0]?.id;

  const groups = orgId ? await findDuplicateConstituentGroups(orgId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Possible duplicate donors</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Flagged on a matching email address, or a similar name plus the same phone number.
          Pick which record to keep — the others merge into it. Nothing is deleted: a merged
          record&rsquo;s history (registrations, item donations, receipts) stays exactly as it
          was, just no longer listed as its own separate donor.
        </p>
      </div>

      <form className={`flex flex-wrap items-end gap-3 text-sm ${card}`}>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Organization</label>
          <select name="orgId" defaultValue={orgId} className={input}>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={button.secondary}>
          Show
        </button>
      </form>

      {groups.length === 0 && (
        <p className={`${card} text-sm text-neutral-500`}>
          No likely duplicates found for this organization right now.
        </p>
      )}

      {groups.map((group, i) => (
        <AdminForm
          key={i}
          action={mergeConstituentsAction}
          successMessage="Merged."
          className={`${card} space-y-3`}
        >
          <input type="hidden" name="orgId" value={orgId} />
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {REASON_LABELS[group.reason]}
          </p>
          <div className="space-y-2">
            {group.constituents.map((c) => {
              const name = c.isBusiness ? c.orgName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
              return (
                <label key={c.id} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-2 text-sm">
                  <input
                    type="radio"
                    name="targetId"
                    value={c.id}
                    defaultChecked={c.id === group.constituents[0].id}
                    className="mt-1"
                  />
                  <input type="hidden" name="sourceId" value={c.id} />
                  <span>
                    <span className="font-medium">{name || "(no name)"}</span>
                    <span className="block text-xs text-neutral-500">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "—"} · added{" "}
                      {c.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <SubmitButton
            pendingLabel="Merging…"
            className={button.primary}
            confirmMessage="Merge the unselected records into the one you picked? Their history stays intact, but they'll no longer appear as separate donors."
          >
            Merge into selected
          </SubmitButton>
        </AdminForm>
      ))}
    </div>
  );
}
