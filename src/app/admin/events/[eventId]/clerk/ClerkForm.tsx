"use client";

import { useEffect, useRef, useState } from "react";

interface LogEntry {
  id: string;
  text: string;
  isError: boolean;
}

export function ClerkForm({ eventId }: { eventId: string }) {
  const [clerkName, setClerkName] = useState("");
  const [itemNumber, setItemNumber] = useState("");
  const [bidderNumber, setBidderNumber] = useState("");
  const [hammerPrice, setHammerPrice] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // One-time hydration of a persisted preference from localStorage,
    // which isn't available during server rendering — there's no way to
    // know this value before mount, so an effect is the correct place.
    const stored = window.localStorage.getItem("clerkName");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setClerkName(stored);
    itemInputRef.current?.focus();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("clerkName", clerkName);
  }, [clerkName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkName.trim()) {
      setLog((prev) => [
        { id: crypto.randomUUID(), text: "Enter the clerk's name first.", isError: true },
        ...prev,
      ]);
      return;
    }
    const hammerPriceCents = Math.round(Number(hammerPrice) * 100);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          itemNumber,
          bidderNumber,
          hammerPriceCents,
          actorId: clerkName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLog((prev) => [
          { id: crypto.randomUUID(), text: data.message ?? "Entry failed", isError: true },
          ...prev,
        ]);
      } else {
        setLog((prev) => [
          {
            id: crypto.randomUUID(),
            text: `${itemNumber} — ${data.award.itemTitle} → paddle #${bidderNumber} for $${(hammerPriceCents / 100).toFixed(2)}`,
            isError: false,
          },
          ...prev,
        ]);
        setItemNumber("");
        setBidderNumber("");
        setHammerPrice("");
      }
    } catch {
      setLog((prev) => [
        { id: crypto.randomUUID(), text: "Network error — try again.", isError: true },
        ...prev,
      ]);
    } finally {
      setSubmitting(false);
      itemInputRef.current?.focus();
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4">
        <label className="text-xs text-neutral-500">Clerk name (for the audit log)</label>
        <input
          value={clerkName}
          onChange={(e) => setClerkName(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-lg"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded border border-brand-lavender bg-white p-6">
        <div>
          <label className="text-sm font-medium text-neutral-700">Item #</label>
          <input
            ref={itemInputRef}
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            required
            autoComplete="off"
            className="mt-1 w-full rounded border border-neutral-300 px-4 py-3 text-2xl"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Paddle #</label>
          <input
            value={bidderNumber}
            onChange={(e) => setBidderNumber(e.target.value)}
            type="number"
            required
            autoComplete="off"
            className="mt-1 w-full rounded border border-neutral-300 px-4 py-3 text-2xl"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700">Hammer price ($)</label>
          <input
            value={hammerPrice}
            onChange={(e) => setHammerPrice(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            required
            autoComplete="off"
            className="mt-1 w-full rounded border border-neutral-300 px-4 py-3 text-2xl"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand-purple py-3 text-xl font-semibold text-white disabled:opacity-50"
        >
          Next
        </button>
      </form>

      <div className="mt-6 space-y-1">
        {log.map((entry) => (
          <div
            key={entry.id}
            className={entry.isError ? "text-sm text-red-600" : "text-sm text-neutral-700"}
          >
            {entry.isError ? "⚠ " : "✓ "}
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
