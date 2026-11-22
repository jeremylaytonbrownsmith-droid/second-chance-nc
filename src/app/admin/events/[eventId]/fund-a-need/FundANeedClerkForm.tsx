"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { button, card, input } from "../../../ui";

interface RegistrationOption {
  id: string;
  bidderNumber: number;
  name: string;
}

const GIVING_LEVELS_CENTS = [100_000, 50_000, 25_000, 10_000, 5_000, 2_500, 1_000];

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export function FundANeedClerkForm({
  eventId,
  registrations,
}: {
  eventId: string;
  registrations: RegistrationOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [levelCents, setLevelCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const amountCents = levelCents ?? (Math.round(Number(customAmount) * 100) || 0);

  function togglePaddle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (amountCents <= 0) {
      toast.error("Pick or enter a giving level first.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Tap at least one paddle.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/fund-a-need", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          amountCents,
          registrationIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Batch failed.");
        return;
      }
      const results: { ok: boolean; bidderNumber: number | null; error?: string }[] = data.results;
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success(
          `Recorded ${money(amountCents)} from ${succeeded.length} paddle${succeeded.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.error(
          `${succeeded.length} recorded, ${failed.length} failed: paddle${failed.length === 1 ? "" : "s"} ${failed
            .map((f) => `#${f.bidderNumber ?? "?"}`)
            .join(", ")}.`,
        );
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${card} space-y-4`}>
      <div>
        <div className="text-xs font-medium text-neutral-500">Giving level</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {GIVING_LEVELS_CENTS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => {
                setLevelCents(cents);
                setCustomAmount("");
              }}
              className={
                levelCents === cents
                  ? "rounded-full bg-brand-purple px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                  : "rounded-full border border-brand-purple px-3 py-1.5 text-sm font-medium text-brand-purple transition-colors hover:bg-brand-lavender-tint"
              }
            >
              {money(cents)}
            </button>
          ))}
          <input
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setLevelCents(null);
            }}
            type="number"
            step="0.01"
            min="0"
            placeholder="Custom $"
            className={`w-28 ${input}`}
          />
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-neutral-500">
          Tap every paddle that went up at {amountCents > 0 ? money(amountCents) : "this level"}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {registrations.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => togglePaddle(r.id)}
              title={r.name}
              className={
                selectedIds.has(r.id)
                  ? "rounded-full bg-brand-purple px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                  : "rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-purple hover:text-brand-purple"
              }
            >
              #{r.bidderNumber}
            </button>
          ))}
          {registrations.length === 0 && (
            <p className="text-sm text-neutral-500">No checked-in bidders yet.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || amountCents <= 0 || selectedIds.size === 0}
        className={`${button.primary} w-full py-2.5 text-base`}
      >
        {submitting
          ? "Recording…"
          : `Record ${money(amountCents)} from ${selectedIds.size} paddle${selectedIds.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
