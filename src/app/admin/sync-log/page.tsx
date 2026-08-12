import { listRecentSyncLogs } from "@/lib/etapestry/demo-sync";
import { retrySyncAction } from "../actions";

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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-2 pr-4">Entity</th>
            <th className="py-2 pr-4">Local ID</th>
            <th className="py-2 pr-4">Remote Ref</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Attempts</th>
            <th className="py-2 pr-4">Last Attempt</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4">{log.entityType}</td>
              <td className="py-2 pr-4 font-mono text-xs">{log.localId.slice(0, 12)}…</td>
              <td className="py-2 pr-4 font-mono text-xs">{log.remoteRef ?? "—"}</td>
              <td className="py-2 pr-4">
                <span
                  className={
                    log.status === "SUCCESS"
                      ? "text-green-700"
                      : log.status === "FAILED"
                        ? "text-red-600"
                        : "text-neutral-500"
                  }
                >
                  {log.status}
                </span>
              </td>
              <td className="py-2 pr-4">{log.attempts}</td>
              <td className="py-2 pr-4">
                {log.lastAttemptAt ? log.lastAttemptAt.toISOString() : "—"}
              </td>
              <td className="py-2 pr-4">
                <form action={retrySyncAction}>
                  <input type="hidden" name="transactionId" value={log.localId} />
                  <button className="text-brand-purple underline">Retry</button>
                </form>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-neutral-500">
                No sync activity yet — complete a checkout to see it here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
