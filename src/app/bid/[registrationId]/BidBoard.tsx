"use client";

import { useEffect, useState } from "react";

interface ItemViewModel {
  id: string;
  itemNumber: string;
  title: string;
  fmvCents: number | null;
  bidIncrementCents: number | null;
  status: string;
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

interface BidUpdateEvent {
  currentAmountCents: number;
  leadingBidderNumber: number | null;
  bidCount: number;
}

export function BidBoard({
  registrationId,
  bidderNumber,
  items: initialItems,
}: {
  registrationId: string;
  bidderNumber: number;
  items: ItemViewModel[];
}) {
  const [items, setItems] = useState(initialItems);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Item list is fixed for the lifetime of this page in the demo — one
  // SSE connection per item, closed on unmount.
  useEffect(() => {
    const applyUpdate = (itemId: string, data: BidUpdateEvent) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                currentAmountCents: data.currentAmountCents,
                leadingBidderNumber: data.leadingBidderNumber,
                bidCount: data.bidCount,
              }
            : it,
        ),
      );
    };

    const sources = initialItems.map((item) => {
      const es = new EventSource(`/api/realtime/items/${item.id}`);
      es.addEventListener("snapshot", (e) => {
        applyUpdate(item.id, JSON.parse((e as MessageEvent).data));
      });
      es.addEventListener("bid", (e) => {
        applyUpdate(item.id, JSON.parse((e as MessageEvent).data));
      });
      return es;
    });

    return () => sources.forEach((es) => es.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function placeBid(item: ItemViewModel, amountCents: number) {
    setPending((p) => ({ ...p, [item.id]: true }));
    setErrors((e) => ({ ...e, [item.id]: "" }));
    try {
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          registrationId,
          amountCents,
          source: "MOBILE",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [item.id]: data.message ?? "Bid failed" }));
      }
    } catch {
      setErrors((e) => ({
        ...e,
        [item.id]: "Network error — venue wifi may be down. Try again.",
      }));
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }));
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {items.map((item) => {
        const increment = item.bidIncrementCents ?? 100;
        const nextBid = item.currentAmountCents + increment;
        const youAreLeading = item.leadingBidderNumber === bidderNumber;

        return (
          <div
            key={item.id}
            className="rounded border border-brand-lavender bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {item.itemNumber} — {item.title}
                </div>
                <div className="text-xs text-neutral-500">
                  FMV{" "}
                  {item.fmvCents !== null
                    ? `$${(item.fmvCents / 100).toFixed(2)}`
                    : "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-brand-purple">
                  ${(item.currentAmountCents / 100).toFixed(2)}
                </div>
                <div className="text-xs text-neutral-500">
                  {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {youAreLeading && (
              <div className="mt-2 text-sm font-semibold text-green-700">
                You&apos;re winning!
              </div>
            )}

            {item.status !== "OPEN" ? (
              <div className="mt-3 text-sm text-neutral-500">
                Bidding closed.
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  disabled={pending[item.id]}
                  onClick={() => placeBid(item, nextBid)}
                  className="rounded bg-brand-purple transition-colors hover:bg-brand-purple-dark px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Bid ${(nextBid / 100).toFixed(2)}
                </button>
              </div>
            )}

            {errors[item.id] && (
              <div className="mt-2 text-sm text-red-600">{errors[item.id]}</div>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm text-neutral-500">No silent auction items open right now.</p>
      )}
    </div>
  );
}
