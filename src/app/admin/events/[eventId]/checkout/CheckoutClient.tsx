"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface RegistrationOption {
  id: string;
  bidderNumber: number;
  name: string;
}

interface OutstandingAward {
  awardId: string;
  itemNumber: string;
  itemTitle: string;
  amountCents: number;
  fmvCents: number;
}

interface AdhocLine {
  clientId: string;
  lineType: "RAFFLE" | "FUND_A_NEED" | "CASH_GIFT";
  amountCents: number;
  designation?: string;
}

const ADHOC_LINE_LABELS: Record<AdhocLine["lineType"], string> = {
  RAFFLE: "Raffle tickets",
  FUND_A_NEED: "Fund a need",
  CASH_GIFT: "Cash gift",
};

export function CheckoutClient({
  eventId,
  registrations,
}: {
  eventId: string;
  registrations: RegistrationOption[];
}) {
  void eventId;
  const router = useRouter();
  const [registrationId, setRegistrationId] = useState("");
  const [outstandingAwards, setOutstandingAwards] = useState<OutstandingAward[]>([]);
  const [excludedAwardIds, setExcludedAwardIds] = useState<Set<string>>(new Set());
  const [adhocLines, setAdhocLines] = useState<AdhocLine[]>([]);
  const [newLineType, setNewLineType] = useState<AdhocLine["lineType"]>("CASH_GIFT");
  const [newLineAmount, setNewLineAmount] = useState("");
  const [method, setMethod] = useState<"CARD" | "CASH" | "CHECK">("CARD");
  const [actorId, setActorId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // One-time hydration of a persisted preference from localStorage,
    // which isn't available during server rendering.
    const stored = window.localStorage.getItem("checkoutStaffName");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setActorId(stored);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("checkoutStaffName", actorId);
  }, [actorId]);

  useEffect(() => {
    if (!registrationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutstandingAwards([]);
      return;
    }
    setExcludedAwardIds(new Set());
    setAdhocLines([]);
    fetch(`/api/admin/checkout?registrationId=${registrationId}`)
      .then((r) => r.json())
      .then((data) => setOutstandingAwards(data.outstandingAwards ?? []));
  }, [registrationId]);

  function toggleAward(awardId: string) {
    setExcludedAwardIds((prev) => {
      const next = new Set(prev);
      if (next.has(awardId)) next.delete(awardId);
      else next.add(awardId);
      return next;
    });
  }

  function addAdhocLine() {
    const amountCents = Math.round(Number(newLineAmount) * 100);
    if (!amountCents || amountCents <= 0) return;
    setAdhocLines((prev) => [
      ...prev,
      { clientId: crypto.randomUUID(), lineType: newLineType, amountCents },
    ]);
    setNewLineAmount("");
  }

  function removeAdhocLine(clientId: string) {
    setAdhocLines((prev) => prev.filter((l) => l.clientId !== clientId));
  }

  const includedAwards = outstandingAwards.filter((a) => !excludedAwardIds.has(a.awardId));
  const totalCents =
    includedAwards.reduce((s, a) => s + a.amountCents, 0) +
    adhocLines.reduce((s, l) => s + l.amountCents, 0);

  async function handleCheckout() {
    setError("");
    if (!actorId.trim()) {
      setError("Enter your name first.");
      return;
    }
    const lines = [
      ...includedAwards.map((a) => ({
        lineType: "AUCTION_WIN" as const,
        amountCents: a.amountCents,
        fmvCents: a.fmvCents,
        awardId: a.awardId,
      })),
      ...adhocLines.map((l) => ({ lineType: l.lineType, amountCents: l.amountCents })),
    ];
    if (lines.length === 0) {
      setError("Nothing to check out.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, lines, method, actorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Checkout failed");
        return;
      }
      router.push(`/admin/receipts/${data.transactionId}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded border border-brand-lavender bg-white p-4">
        <label className="text-xs text-neutral-500">Your name (staff)</label>
        <input
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        />

        <label className="mt-4 block text-xs text-neutral-500">Bidder</label>
        <select
          value={registrationId}
          onChange={(e) => setRegistrationId(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        >
          <option value="">Select a bidder…</option>
          {registrations.map((r) => (
            <option key={r.id} value={r.id}>
              #{r.bidderNumber} — {r.name}
            </option>
          ))}
        </select>
      </div>

      {registrationId && (
        <>
          <div className="rounded border border-brand-lavender bg-white p-4">
            <h2 className="font-semibold">Auction wins</h2>
            {outstandingAwards.length === 0 && (
              <p className="mt-2 text-sm text-neutral-500">No unpaid awards.</p>
            )}
            {outstandingAwards.map((a) => (
              <label key={a.awardId} className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!excludedAwardIds.has(a.awardId)}
                  onChange={() => toggleAward(a.awardId)}
                />
                {a.itemNumber} — {a.itemTitle}: ${(a.amountCents / 100).toFixed(2)}{" "}
                <span className="text-neutral-500">
                  (FMV ${(a.fmvCents / 100).toFixed(2)})
                </span>
              </label>
            ))}
          </div>

          <div className="rounded border border-brand-lavender bg-white p-4">
            <h2 className="font-semibold">Other gifts on this checkout</h2>
            {adhocLines.map((l) => (
              <div key={l.clientId} className="mt-2 flex items-center justify-between text-sm">
                <span>
                  {ADHOC_LINE_LABELS[l.lineType]}: ${(l.amountCents / 100).toFixed(2)}
                </span>
                <button
                  onClick={() => removeAdhocLine(l.clientId)}
                  className="text-red-600 underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <select
                value={newLineType}
                onChange={(e) => setNewLineType(e.target.value as AdhocLine["lineType"])}
                className="rounded border border-neutral-300 px-2 py-1"
              >
                <option value="CASH_GIFT">Cash gift</option>
                <option value="FUND_A_NEED">Fund a need</option>
                <option value="RAFFLE">Raffle tickets</option>
              </select>
              <input
                value={newLineAmount}
                onChange={(e) => setNewLineAmount(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                placeholder="$"
                className="w-24 rounded border border-neutral-300 px-2 py-1"
              />
              <button
                onClick={addAdhocLine}
                className="rounded bg-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-300"
              >
                Add
              </button>
            </div>
          </div>

          <div className="rounded border border-brand-lavender bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-brand-purple">
                ${(totalCents / 100).toFixed(2)}
              </span>
            </div>
            <label className="mt-3 block text-xs text-neutral-500">Payment method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "CARD" | "CASH" | "CHECK")}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            >
              <option value="CARD">Card (test — no real charge)</option>
              <option value="CASH">Cash</option>
              <option value="CHECK">Check</option>
            </select>
            <button
              onClick={handleCheckout}
              disabled={submitting || totalCents === 0}
              className="mt-4 w-full rounded bg-brand-purple transition-colors hover:bg-brand-purple-dark py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Processing…" : "Complete checkout"}
            </button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
