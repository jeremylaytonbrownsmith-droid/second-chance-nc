"use client";

import { useEffect, useState } from "react";
import { subscribeBidQueue } from "@/lib/offline/bid-queue";

/**
 * Event night item 15: "show sync status". A thin banner, not a toast —
 * stays visible the whole time something is queued, since a bidder who
 * glances back at their phone after reconnecting needs to see at a
 * glance whether their bid already went out or is still waiting.
 */
export function SyncStatusBanner() {
  const [state, setState] = useState<{ pendingCount: number; isOffline: boolean }>({
    pendingCount: 0,
    isOffline: false,
  });

  useEffect(() => {
    return subscribeBidQueue((s) => setState({ pendingCount: s.pending.length, isOffline: s.isOffline }));
  }, []);

  if (state.pendingCount === 0 && !state.isOffline) return null;

  if (state.isOffline) {
    return (
      <div className="rounded-lg bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-800">
        {state.pendingCount > 0
          ? `You’re offline — ${state.pendingCount} bid${state.pendingCount === 1 ? "" : "s"} queued, will send automatically once you’re back online.`
          : "You’re offline — bids you place now will be sent automatically once you’re back online."}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-brand-lavender-tint px-3 py-2 text-center text-sm font-semibold text-brand-purple-dark">
      Reconnected — sending {state.pendingCount} queued bid{state.pendingCount === 1 ? "" : "s"}…
    </div>
  );
}
