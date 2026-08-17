import { listRecentSyncLogs } from "@/lib/etapestry/demo-sync";
import { retrySyncAction } from "../actions";
import { button, table } from "../ui";

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PENDING: "bg-neutral-100 text-neutral-700",
};

export default async function SyncLogPage() {
  const logs = await listRecentSyncLogs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">eTapestry Sync Log</h1>
        <p className="text-sm text-neutral-500">
          The real eTapestry connection is pending the organization enabling API
          access (Section 7). This shows the same queue/idempotency logic that
          will drive it, with a simulated push standing in for the SOAP call.
        </p>
      </div>
      <div className={table.wrapper}>
        <table className={`min-w-[720px] ${table.table}`}>
          <thead>
            <tr className={table.headRow}>
              <th className={table.th}>Entity</th>
              <th className={table.th}>Local ID</th>
              <th className={table.th}>Remote Ref</th>
              <th className={table.th}>Status</th>
              <th className={table.th}>Attempts</th>
              <th className={table.th}>Last Attempt</th>
              <th className={table.th}></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className={table.row}>
                <td className={table.td}>{log.entityType}</td>
                <td className={`${table.td} font-mono text-xs`}>{log.localId.slice(0, 12)}…</td>
                <td className={`${table.td} font-mono text-xs`}>{log.remoteRef ?? "—"}</td>
                <td className={table.td}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[log.status] ?? STATUS_STYLES.PENDING}`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className={table.td}>{log.attempts}</td>
                <td className={table.td}>
                  {log.lastAttemptAt ? log.lastAttemptAt.toISOString() : "—"}
                </td>
                <td className={table.td}>
                  <form action={retrySyncAction}>
                    <input type="hidden" name="transactionId" value={log.localId} />
                    <button className={button.ghost}>Retry</button>
                  </form>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className={table.empty}>
                  No sync activity yet — complete a checkout to see it here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
