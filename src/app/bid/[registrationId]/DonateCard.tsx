"use client";

import { useState } from "react";

const PRESET_AMOUNTS_CENTS = [2_500, 5_000, 10_000, 25_000];

export function DonateCard({ registrationId }: { registrationId: string }) {
  const [customAmount, setCustomAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [givenCents, setGivenCents] = useState<number | null>(null);

  async function donate(amountCents: number) {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, amountCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Donation failed");
        return;
      }
      setGivenCents((prev) => (prev ?? 0) + amountCents);
      setCustomAmount("");
    } catch {
      setError("Network error — venue wifi may be down. Try again.");
    } finally {
      setPending(false);
    }
  }

  function handleCustomSubmit() {
    const dollars = Number(customAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    donate(Math.round(dollars * 100));
  }

  return (
    <div className="mb-6 rounded-2xl border border-brand-lavender/50 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Make a gift</p>
      <h2 className="mt-0.5 text-lg font-bold text-brand-purple-dark">Donate tonight</h2>

      {givenCents !== null && (
        <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
          Thank you — you&apos;ve given ${(givenCents / 100).toFixed(2)} tonight.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESET_AMOUNTS_CENTS.map((cents) => (
          <button
            key={cents}
            disabled={pending}
            onClick={() => donate(cents)}
            className="rounded-lg border border-brand-purple px-3 py-2.5 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            ${(cents / 100).toFixed(0)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
            $
          </span>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Other amount"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-6 pr-3 text-sm shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
          />
        </div>
        <button
          disabled={pending || !customAmount}
          onClick={handleCustomSubmit}
          className="shrink-0 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Giving…" : "Give"}
        </button>
      </div>

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
