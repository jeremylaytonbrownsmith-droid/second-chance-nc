import { listOrganizations } from "@/lib/admin/organizations";
import { listDonorYearEndStatementsForOrg } from "@/lib/statements/year-end";
import { getStaffRole } from "@/lib/admin/session";
import { AdminOnlyNotice } from "../AdminOnlyNotice";
import { button, card, input, label as labelClass, table } from "../ui";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function YearEndStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; taxYear?: string }>;
}) {
  if ((await getStaffRole()) !== "admin") return <AdminOnlyNotice />;

  const organizations = await listOrganizations();
  const { orgId: orgIdParam, taxYear: taxYearParam } = await searchParams;
  const orgId = orgIdParam ?? organizations[0]?.id;
  const taxYear = Number(taxYearParam) || new Date().getUTCFullYear();

  const statements = orgId ? await listDonorYearEndStatementsForOrg(orgId, taxYear) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Year-end donor statements</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every constituent&rsquo;s auction purchases, cash gifts, and fund-a-need giving for one
          organization in one tax year, combined into a single deductible total.
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
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Tax year</label>
          <input name="taxYear" type="number" defaultValue={taxYear} className={`w-28 ${input}`} />
        </div>
        <button type="submit" className={button.secondary}>
          Show
        </button>
        {orgId && (
          <a
            className={button.primary}
            href={`/api/admin/statements?orgId=${orgId}&taxYear=${taxYear}&format=csv`}
          >
            Download CSV (all donors)
          </a>
        )}
      </form>

      <div className={table.wrapper}>
        <table className={`min-w-[640px] ${table.table}`}>
          <thead>
            <tr className={table.headRow}>
              <th className={table.th}>Donor</th>
              <th className={table.th}>Email</th>
              <th className={table.th}>Total paid</th>
              <th className={table.th}>Total deductible</th>
              <th className={table.th}></th>
            </tr>
          </thead>
          <tbody>
            {statements.map((s) => (
              <tr key={s.constituentId} className={table.row}>
                <td className={table.td}>{s.donorName || "—"}</td>
                <td className={table.td}>{s.donorEmail || "—"}</td>
                <td className={table.td}>{money(s.totalAmountCents)}</td>
                <td className={table.td}>{money(s.totalDeductibleCents)}</td>
                <td className={table.td}>
                  <a
                    className={button.tableAction}
                    href={`/api/admin/statements/${s.constituentId}/pdf?orgId=${orgId}&taxYear=${taxYear}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {statements.length === 0 && (
              <tr>
                <td colSpan={5} className={table.empty}>
                  No giving recorded for this organization in {taxYear}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
