"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface ItemViewModel {
  id: string;
  itemNumber: string;
  title: string;
  category: string | null;
  image: string | null;
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
    <div className="space-y-4">
      {items.map((item) => {
        const increment = item.bidIncrementCents ?? 100;
        const nextBid = item.currentAmountCents + increment;
        const youAreLeading = item.leadingBidderNumber === bidderNumber;

        return (
          <div
            key={item.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow duration-200 ${
              youAreLeading ? "border-green-400 shadow-md shadow-green-100" : "border-brand-lavender/50"
            }`}
          >
            <div className="flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-lavender-tint">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-lavender/50 to-brand-purple/20">
                    <Image
                      src="/brand/paw-icon.png"
                      alt=""
                      width={40}
                      height={40}
                      className="h-9 w-9 opacity-40"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {item.itemNumber} {item.category ? `· ${item.category}` : ""}
                </div>
                <div className="truncate text-base font-bold leading-tight text-neutral-900">{item.title}</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  FMV {item.fmvCents !== null ? `$${(item.fmvCents / 100).toFixed(2)}` : "—"}
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-2xl font-extrabold tracking-tight text-brand-purple">
                      ${(item.currentAmountCents / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {item.bidCount} bid{item.bidCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  {youAreLeading && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                      You&apos;re winning!
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100 px-4 py-3">
              {item.status !== "OPEN" ? (
                <div className="text-sm text-neutral-500">Bidding closed.</div>
              ) : (
                <button
                  disabled={pending[item.id]}
                  onClick={() => placeBid(item, nextBid)}
                  className="w-full rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-purple-dark hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending[item.id] ? "Placing bid…" : `Bid $${(nextBid / 100).toFixed(2)}`}
                </button>
              )}

              {errors[item.id] && <div className="mt-2 text-sm text-red-600">{errors[item.id]}</div>}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm text-neutral-500">No silent auction items open right now.</p>
      )}
    </div>
  );
}
