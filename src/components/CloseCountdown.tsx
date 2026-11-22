"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Closing…";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Staggered close (Event night, item 11): a live countdown to an item's
 * closeAt, shown on both the bidder view and the live board so the room
 * can see a category about to lock without refreshing. Ticks client-side
 * only — the actual close is enforced server-side by closeExpiredItemsForEvent
 * and placeBid's own closeAt check (src/lib/auction/bidding.ts); this
 * component never decides anything, it only displays.
 */
export function CloseCountdown({ closeAt }: { closeAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!closeAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [closeAt]);

  if (!closeAt) return null;
  const target = new Date(closeAt).getTime();
  // Before the client's first tick, render nothing rather than guessing —
  // avoids a hydration mismatch between server and client clocks.
  if (now === null) return null;

  const remainingMs = target - now;
  const urgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        remainingMs <= 0
          ? "bg-neutral-200 text-neutral-600"
          : urgent
            ? "bg-red-100 text-red-700"
            : "bg-brand-lavender-tint text-brand-purple-dark"
      }`}
    >
      {remainingMs <= 0 ? "Closing…" : `Closes in ${formatRemaining(remainingMs)}`}
    </span>
  );
}
