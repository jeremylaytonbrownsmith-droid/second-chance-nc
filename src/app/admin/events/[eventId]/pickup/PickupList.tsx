"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { button, input, table } from "../../../ui";

interface AwardRow {
  awardId: string;
  itemNumber: string;
  itemTitle: string;
  bidderNumber: number;
  winnerName: string;
  amountCents: number;
  pickedUpAt: string | null;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PickupList({
  eventId,
  awards,
}: {
  eventId: string;
  awards: AwardRow[];
}) {
  void eventId;
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return awards;
    return awards.filter((a) =>
      [a.itemNumber, a.itemTitle, a.winnerName, `#${a.bidderNumber}`]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [awards, query]);

  const unclaimedCount = awards.filter((a) => !a.pickedUpAt).length;

  async function togglePickup(award: AwardRow) {
    setPendingId(award.awardId);
    try {
      const res = await fetch("/api/admin/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awardId: award.awardId, pickedUp: !award.pickedUpAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Couldn't update pickup status.");
        return;
      }
      toast.success(
        award.pickedUpAt
          ? `${award.itemNumber} marked unclaimed again.`
          : `${award.itemNumber} marked picked up.`,
      );
      router.refresh();
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item, paddle, or winner…"
          className={`w-64 ${input}`}
        />
        <span className="text-sm text-neutral-500">
          {unclaimedCount} unclaimed of {awards.length}
        </span>
      </div>

      <div className={table.wrapper}>
        <table className={table.table}>
          <thead>
            <tr className={table.headRow}>
              <th className={table.th}>Item</th>
              <th className={table.th}>Winner</th>
              <th className={table.th}>Amount</th>
              <th className={table.th}>Status</th>
              <th className={table.th} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className={table.empty} colSpan={5}>
                  {awards.length === 0 ? "No awarded items yet." : "No matches."}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.awardId} className={table.row}>
                  <td className={table.td}>
                    {a.itemNumber} — {a.itemTitle}
                  </td>
                  <td className={table.td}>
                    #{a.bidderNumber} {a.winnerName}
                  </td>
                  <td className={table.td}>{money(a.amountCents)}</td>
                  <td className={table.td}>
                    {a.pickedUpAt ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        Picked up
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Unclaimed
                      </span>
                    )}
                  </td>
                  <td className={table.td}>
                    <button
                      onClick={() => togglePickup(a)}
                      disabled={pendingId === a.awardId}
                      className={a.pickedUpAt ? button.ghost : button.primary}
                    >
                      {pendingId === a.awardId
                        ? "Saving…"
                        : a.pickedUpAt
                          ? "Undo"
                          : "Mark picked up"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
