"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, WarningIcon } from "@/app/admin/icons";
import { useToast } from "@/components/Toast";

interface LogEntry {
  id: string;
  text: string;
  isError: boolean;
}

export function ClerkForm({ eventId }: { eventId: string }) {
  const [itemNumber, setItemNumber] = useState("");
  const [bidderNumber, setBidderNumber] = useState("");
  const [hammerPrice, setHammerPrice] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    itemInputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.message ?? "Entry failed";
        setLog((prev) => [{ id: crypto.randomUUID(), text: message, isError: true }, ...prev]);
        toast.error(message);
      } else {
        const message = `${itemNumber} — ${data.award.itemTitle} → paddle #${bidderNumber} for $${(hammerPriceCents / 100).toFixed(2)}`;
        setLog((prev) => [{ id: crypto.randomUUID(), text: message, isError: false }, ...prev]);
        toast.success("Hammer price recorded.");
        setItemNumber("");
        setBidderNumber("");
        setHammerPrice("");
      }
    } catch {
      const message = "Network error — try again.";
      setLog((prev) => [{ id: crypto.randomUUID(), text: message, isError: true }, ...prev]);
      toast.error(message);
    } finally {
      setSubmitting(false);
      itemInputRef.current?.focus();
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <label className="text-sm font-medium text-neutral-700">Item #</label>
          <input
            ref={itemInputRef}
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-2xl shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
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
            className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-2xl shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
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
            className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-3 text-2xl shadow-sm transition-colors focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-purple py-3 text-xl font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </form>

      <div className="mt-6 space-y-1">
        {log.map((entry) => (
          <div
            key={entry.id}
            className={
              entry.isError
                ? "flex items-center gap-1.5 text-sm text-red-600"
                : "flex items-center gap-1.5 text-sm text-neutral-700"
            }
          >
            {entry.isError ? <WarningIcon /> : <CheckCircleIcon />}
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
